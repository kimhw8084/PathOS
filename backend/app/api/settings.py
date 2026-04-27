from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from typing import List, Any, Optional
import asyncio
import sys
import os
import tempfile
import json
from datetime import datetime, timezone
from ..database import get_db
from ..models.models import SystemParameter, ParameterLog, AppConfig, OrgMember, SavedView, Workflow, WorkflowExecution, AutomationProject
from ..schemas.schemas import (
    SystemParameterUpdate,
    SystemParameterRead,
    ParameterLogRead,
    AppConfigUpdate,
    AppConfigRead,
    OrgMemberCreate,
    OrgMemberRead,
    RuntimeConfigRead,
    RuntimeConfigImport,
    SavedViewCreate,
    SavedViewRead,
    EnvironmentConfigRead,
    EnvironmentConfigUpdate,
)
from pydantic import BaseModel
from ..runtime_defaults import (
    build_frontend_runtime_config,
    get_default_org_members,
    get_fixed_parameters,
    get_parameter_seed_defaults,
    get_rollout_default_configs,
)

router = APIRouter(tags=["settings"])

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
BACKEND_ENV_PATH = os.path.join(ROOT_DIR, "backend", ".env")
FRONTEND_ENV_PATH = os.path.join(ROOT_DIR, "frontend", ".env")


def _read_env_file(path: str) -> str:
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _write_env_file(path: str, content: str) -> None:
    # Ensure directory exists just in case
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


@router.get("/environment-config", response_model=EnvironmentConfigRead)
async def get_environment_config():
    return {
        "backend_env": _read_env_file(BACKEND_ENV_PATH),
        "frontend_env": _read_env_file(FRONTEND_ENV_PATH),
        "backend_path": BACKEND_ENV_PATH,
        "frontend_path": FRONTEND_ENV_PATH,
    }


@router.put("/environment-config")
async def update_environment_config(data: EnvironmentConfigUpdate):
    if data.backend_env is not None:
        _write_env_file(BACKEND_ENV_PATH, data.backend_env)
    if data.frontend_env is not None:
        _write_env_file(FRONTEND_ENV_PATH, data.frontend_env)
    return {"status": "success", "message": "Environment files updated. Restart services to apply changes."}


FIXED_PARAMETERS = get_fixed_parameters()


async def ensure_rollout_defaults(db: AsyncSession):
    result = await db.execute(select(AppConfig))
    existing = {item.key: item for item in result.scalars().all()}
    changed = False
    defaults = get_rollout_default_configs()
    for key, payload in defaults.items():
      if key not in existing:
        db.add(AppConfig(key=key, label=payload["label"], description=payload["description"], value=payload["value"]))
        changed = True
    member_result = await db.execute(select(OrgMember))
    members = member_result.scalars().all()
    if not members:
        db.add_all([OrgMember(**member) for member in get_default_org_members()])
        changed = True
    if changed:
        await db.commit()


async def _runtime_config_payload(db: AsyncSession) -> dict[str, Any]:
    await ensure_rollout_defaults(db)
    config_result = await db.execute(select(AppConfig).where(AppConfig.is_deleted == False))
    member_result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False).order_by(OrgMember.full_name.asc()))
    configs = config_result.scalars().all()
    members = member_result.scalars().all()
    config_map = {item.key: AppConfigRead.model_validate(item).model_dump(mode="json") for item in configs}
    company_rollout = config_map.get("company_rollout", {})
    active_email = ((company_rollout.get("value") or {}) if company_rollout else {}).get("active_member_email")
    active_member = next((member for member in members if member.email == active_email), members[0] if members else None)
    return build_frontend_runtime_config(
        OrgMemberRead.model_validate(active_member).model_dump(mode="json") if active_member else None,
        [OrgMemberRead.model_validate(item).model_dump(mode="json") for item in members],
        config_map,
    )


async def ensure_parameter_defaults(db: AsyncSession) -> None:
    result = await db.execute(select(SystemParameter))
    params = result.scalars().all()
    existing_by_key = {p.key: p for p in params}
    changed = False
    for definition in get_parameter_seed_defaults():
        key = definition["key"]
        if key not in existing_by_key:
            db.add(
                SystemParameter(
                    key=key,
                    label=definition.get("label", key.replace("_", " ").title()),
                    description=definition.get("description"),
                    is_dynamic=False,
                    manual_values=definition.get("values", []),
                    cached_values=definition.get("values", []),
                )
            )
            changed = True
            continue
        param = existing_by_key[key]
        if not param.label:
            param.label = definition.get("label", key.replace("_", " ").title())
            changed = True
        if not param.description:
            param.description = definition.get("description")
            changed = True
        if not param.manual_values:
            param.manual_values = definition.get("values", [])
            changed = True
        if param.cached_values is None:
            param.cached_values = definition.get("values", [])
            changed = True
    for key in FIXED_PARAMETERS:
        if key not in existing_by_key and all(defn["key"] != key for defn in get_parameter_seed_defaults()):
            db.add(SystemParameter(key=key, label=key.replace('_', ' ').title(), is_dynamic=False, manual_values=[]))
            changed = True
    if changed:
        await db.commit()

@router.get("/parameters", response_model=List[SystemParameterRead])
async def list_parameters(db: AsyncSession = Depends(get_db)):
    await ensure_parameter_defaults(db)
    result = await db.execute(select(SystemParameter))
    return result.scalars().all()

@router.put("/parameters/{key}", response_model=SystemParameterRead)
async def update_parameter(key: str, data: SystemParameterUpdate, db: AsyncSession = Depends(get_db)):
    if key not in FIXED_PARAMETERS:
        raise HTTPException(status_code=403, detail="Adding new parameters is not allowed")
        
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    
    if not param:
        param = SystemParameter(key=key)
        db.add(param)
    
    param.label = data.label
    param.description = data.description
    param.is_dynamic = data.is_dynamic
    param.manual_values = data.manual_values
    param.python_code = data.python_code
    
    await db.commit()
    await db.refresh(param)
    return param

async def run_parameter_logic(param: SystemParameter, db: AsyncSession):
    start_time = datetime.now()
    found_values = []
    error_msg = None
    status = "SUCCESS"

    if param.is_dynamic:
        if not param.python_code:
            status = "FAILED"
            error_msg = "No Python code provided"
        else:
            wrapper_code = f"""
import json
import sys
import pandas as pd

{param.python_code}

try:
    if 'result' in locals():
        output = result
    elif 'df' in locals():
        output = df.iloc[:, 0].tolist() if isinstance(df, pd.DataFrame) else df
    else:
        output = []
    
    print("---JSON_START---")
    print(json.dumps({{"values": list(output)}}))
    print("---JSON_END---")
except Exception as e:
    print("---JSON_START---")
    print(json.dumps({{"error": str(e)}}))
    print("---JSON_END---")
"""
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as tmp:
                    tmp.write(wrapper_code)
                    tmp_path = tmp.name

                proc = await asyncio.create_subprocess_exec(
                    sys.executable, tmp_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                try:
                    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
                    stdout_str = stdout.decode().strip()
                    stderr_str = stderr.decode().strip()

                    if proc.returncode != 0:
                        status = "FAILED"
                        error_msg = stderr_str or f"Exit code {proc.returncode}"
                    elif "---JSON_START---" in stdout_str:
                        json_part = stdout_str.split("---JSON_START---")[1].split("---JSON_END---")[0].strip()
                        output_data = json.loads(json_part)
                        if "error" in output_data:
                            status = "FAILED"
                            error_msg = output_data["error"]
                        else:
                            found_values = output_data["values"]
                    else:
                        status = "FAILED"
                        error_msg = "No JSON output found"
                except asyncio.TimeoutError:
                    proc.kill()
                    status = "FAILED"
                    error_msg = "Timeout (30s)"
            except Exception as e:
                status = "FAILED"
                error_msg = str(e)
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)
    else:
        found_values = param.manual_values or []

    execution_time = (datetime.now() - start_time).total_seconds()
    
    # Logic for discrepancies
    # If it's the first time running (cached_values is None), we just set them
    if param.cached_values is None:
        param.cached_values = found_values
        param.has_discrepancy = False
        param.pending_values = None
    else:
        # Compare sets of values
        current_set = set(param.cached_values)
        found_set = set(found_values)
        
        if current_set != found_set:
            status = "DISCREPANCY"
            param.has_discrepancy = True
            param.pending_values = found_values
            error_msg = f"Discrepancy found: {len(found_set)} items vs {len(current_set)} existing"
        else:
            param.has_discrepancy = False
            param.pending_values = None

    param.last_executed = datetime.now()
    
    # Log the run
    log = ParameterLog(
        parameter_key=param.key,
        status=status,
        message=error_msg,
        found_values=found_values,
        execution_time=execution_time
    )
    db.add(log)
    await db.commit()
    return { "status": status, "values": found_values, "error": error_msg }

@router.post("/parameters/{key}/execute")
async def execute_parameter(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    
    return await run_parameter_logic(param, db)

@router.get("/parameters/{key}/logs", response_model=List[ParameterLogRead])
async def list_parameter_logs(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ParameterLog)
        .where(ParameterLog.parameter_key == key)
        .order_by(ParameterLog.timestamp.desc())
        .limit(50)
    )
    return result.scalars().all()

@router.post("/parameters/{key}/resolve")
async def resolve_discrepancy(key: str, action: str, db: AsyncSession = Depends(get_db)):
    # action: "CONFIRM" (overwrite cached with pending) or "IGNORE" (clear pending)
    result = await db.execute(select(SystemParameter).where(SystemParameter.key == key))
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status_code=404, detail="Parameter not found")
    
    if action == "CONFIRM":
        if param.pending_values is not None:
            param.cached_values = param.pending_values
    
    param.pending_values = None
    param.has_discrepancy = False
    await db.commit()
    return param


@router.get("/admin-overview")
async def admin_overview(db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    config_result = await db.execute(select(AppConfig).where(AppConfig.is_deleted == False))
    member_result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False))
    view_result = await db.execute(select(SavedView).where(SavedView.is_deleted == False))
    configs = config_result.scalars().all()
    members = member_result.scalars().all()
    views = view_result.scalars().all()
    company_rollout = next((item for item in configs if item.key == "company_rollout"), None)
    active_email = ((company_rollout.value or {}) if company_rollout else {}).get("active_member_email")
    active_member = next((member for member in members if member.email == active_email), members[0] if members else None)
    return {
        "configs": [AppConfigRead.model_validate(item) for item in configs],
        "members": [OrgMemberRead.model_validate(item) for item in members],
        "saved_views": [SavedViewRead.model_validate(item) for item in views],
        "teams": sorted({member.team for member in members if member.team}),
        "sites": sorted({member.site for member in members if member.site}),
        "orgs": sorted({member.org for member in members if member.org}),
        "active_member": OrgMemberRead.model_validate(active_member).model_dump(mode="json") if active_member else None,
    }


@router.get("/runtime-config", response_model=RuntimeConfigRead)
async def runtime_config(db: AsyncSession = Depends(get_db)):
    return await _runtime_config_payload(db)


@router.get("/quality-overview")
async def quality_overview(db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    workflow_result = await db.execute(select(Workflow).where(Workflow.is_deleted == False))
    execution_result = await db.execute(select(WorkflowExecution).where(WorkflowExecution.is_deleted == False))
    project_result = await db.execute(select(AutomationProject).where(AutomationProject.is_deleted == False))
    parameter_result = await db.execute(select(SystemParameter))
    log_result = await db.execute(select(ParameterLog).order_by(ParameterLog.timestamp.desc()).limit(20))
    member_result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False))
    workflows = workflow_result.scalars().all()
    executions = execution_result.scalars().all()
    projects = project_result.scalars().all()
    parameters = parameter_result.scalars().all()
    logs = log_result.scalars().all()
    members = member_result.scalars().all()

    discrepancy_count = sum(1 for parameter in parameters if parameter.has_discrepancy)
    stale_count = 0
    open_review_count = 0
    unread_notification_count = 0
    for workflow in workflows:
        governance = workflow.governance or {}
        review_requests = workflow.review_requests or []
        notifications = workflow.notification_feed or []
        if workflow.updated_at:
            stale_after_days = governance.get("stale_after_days", 90)
            updated_at_aware = workflow.updated_at
            if updated_at_aware.tzinfo is None:
                updated_at_aware = updated_at_aware.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - updated_at_aware).days > stale_after_days:
                stale_count += 1
        if workflow.review_state not in {"Approved", "Completed"} or any(request.get("status") == "open" for request in review_requests):
            open_review_count += 1
        unread_notification_count += sum(1 for notification in notifications if not notification.get("read"))

    latest_logs = [
        {
            "parameter_key": log.parameter_key,
            "status": log.status,
            "message": log.message,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "execution_time": log.execution_time,
        }
        for log in logs
    ]
    return {
        "portfolio": {
            "workflow_count": len(workflows),
            "execution_count": len(executions),
            "project_count": len(projects),
            "org_member_count": len(members),
        },
        "quality": {
            "stale_workflow_count": stale_count,
            "open_review_count": open_review_count,
            "unread_notification_count": unread_notification_count,
            "parameter_discrepancy_count": discrepancy_count,
            "active_project_risk_count": sum(1 for project in projects if project.health in {"Blocked", "At Risk"}),
        },
        "parameter_runs": latest_logs,
        "developer_commands": {
            "backend_tests": "cd backend && pytest",
            "frontend_tests": "cd frontend && npm test",
            "frontend_build": "cd frontend && npm run build",
            "playwright_local": "cd frontend && npm run test:e2e",
        },
    }


@router.get("/app-config/{key}", response_model=AppConfigRead)
async def get_app_config(key: str, db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    result = await db.execute(select(AppConfig).where(AppConfig.key == key, AppConfig.is_deleted == False))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return config


@router.get("/runtime-config/export")
async def export_runtime_config(db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    config_result = await db.execute(select(AppConfig).where(AppConfig.is_deleted == False))
    member_result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False))
    view_result = await db.execute(select(SavedView).where(SavedView.is_deleted == False))
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "runtime_config": await _runtime_config_payload(db),
        "app_configs": [AppConfigRead.model_validate(item).model_dump(mode="json") for item in config_result.scalars().all()],
        "members": [OrgMemberRead.model_validate(item).model_dump(mode="json") for item in member_result.scalars().all()],
        "saved_views": [SavedViewRead.model_validate(item).model_dump(mode="json") for item in view_result.scalars().all()],
    }


@router.post("/runtime-config/import")
async def import_runtime_config(data: RuntimeConfigImport, db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    for config_payload in data.app_configs:
        result = await db.execute(select(AppConfig).where(AppConfig.key == config_payload.key, AppConfig.is_deleted == False))
        config = result.scalar_one_or_none()
        if not config:
            db.add(AppConfig(**config_payload.model_dump()))
            continue
        config.label = config_payload.label
        config.description = config_payload.description
        config.value = config_payload.value
    for member_payload in data.members:
        result = await db.execute(select(OrgMember).where(OrgMember.email == member_payload.email, OrgMember.is_deleted == False))
        member = result.scalar_one_or_none()
        if not member:
            db.add(OrgMember(**member_payload.model_dump()))
            continue
        for key, value in member_payload.model_dump().items():
            setattr(member, key, value)
    for view_payload in data.saved_views:
        result = await db.execute(
            select(SavedView).where(
                SavedView.name == view_payload.name,
                SavedView.owner_email == view_payload.owner_email,
                SavedView.entity_type == view_payload.entity_type,
                SavedView.is_deleted == False,
            )
        )
        saved_view = result.scalar_one_or_none()
        if not saved_view:
            db.add(SavedView(**view_payload.model_dump()))
            continue
        for key, value in view_payload.model_dump().items():
            setattr(saved_view, key, value)
    await db.commit()
    return await _runtime_config_payload(db)


@router.put("/app-config/{key}", response_model=AppConfigRead)
async def update_app_config(key: str, data: AppConfigUpdate, db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    result = await db.execute(select(AppConfig).where(AppConfig.key == key, AppConfig.is_deleted == False))
    config = result.scalar_one_or_none()
    if not config:
        config = AppConfig(key=key, label=data.label, description=data.description, value=data.value)
        db.add(config)
    else:
        config.label = data.label
        config.description = data.description
        config.value = data.value
    await db.commit()
    await db.refresh(config)
    return config


@router.get("/members", response_model=List[OrgMemberRead])
async def list_org_members(db: AsyncSession = Depends(get_db)):
    await ensure_rollout_defaults(db)
    result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False).order_by(OrgMember.full_name.asc()))
    return result.scalars().all()


@router.post("/members", response_model=OrgMemberRead)
async def create_org_member(data: OrgMemberCreate, db: AsyncSession = Depends(get_db)):
    member = OrgMember(**data.model_dump())
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.put("/members/{member_id}", response_model=OrgMemberRead)
async def update_org_member(member_id: int, data: OrgMemberCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OrgMember).where(OrgMember.id == member_id, OrgMember.is_deleted == False))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    for key, value in data.model_dump().items():
        setattr(member, key, value)
    await db.commit()
    await db.refresh(member)
    return member


@router.get("/saved-views", response_model=List[SavedViewRead])
async def list_saved_views(entity_type: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(SavedView).where(SavedView.is_deleted == False)
    if entity_type:
        query = query.where(SavedView.entity_type == entity_type)
    result = await db.execute(query.order_by(SavedView.created_at.desc()))
    return result.scalars().all()


@router.post("/saved-views", response_model=SavedViewRead)
async def create_saved_view(data: SavedViewCreate, db: AsyncSession = Depends(get_db)):
    saved_view = SavedView(**data.model_dump())
    db.add(saved_view)
    await db.commit()
    await db.refresh(saved_view)
    return saved_view


@router.put("/saved-views/{view_id}", response_model=SavedViewRead)
async def update_saved_view(view_id: int, data: SavedViewCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedView).where(SavedView.id == view_id, SavedView.is_deleted == False))
    saved_view = result.scalar_one_or_none()
    if not saved_view:
        raise HTTPException(status_code=404, detail="Saved view not found")
    for key, value in data.model_dump().items():
        setattr(saved_view, key, value)
    await db.commit()
    await db.refresh(saved_view)
    return saved_view

async def run_all_parameters(db: AsyncSession):
    await ensure_parameter_defaults(db)
    result = await db.execute(select(SystemParameter))
    params = result.scalars().all()
    for param in params:
        await run_parameter_logic(param, db)
