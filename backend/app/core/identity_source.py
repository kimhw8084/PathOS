from __future__ import annotations

import asyncio
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import ROOT_DIR
from ..models.models import IdentitySource, IdentitySourceSnapshot, IdentitySourceSnapshotRow, OrgMember
from ..runtime_defaults import get_default_identity_source

ACTIVE_STATUSES = {"active", "enabled", "current"}
INACTIVE_STATUSES = {"inactive", "terminated", "deleted", "left", "archived"}
REQUIRED_COLUMNS = ["employee_id", "full_name", "email"]
DEFAULT_IDENTITY_SOURCE_NAME = "Local Python Roster Source"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, tuple):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except Exception:
            pass
        return [chunk.strip() for chunk in stripped.replace(";", ",").replace("\n", ",").split(",") if chunk.strip()]
    return [str(value).strip()] if str(value).strip() else []


def _pick_python_executable(source: IdentitySource) -> str:
    candidate = (source.venv_path or "").strip()
    if not candidate:
        return sys.executable
    path = Path(candidate).expanduser()
    if not path.is_absolute():
        root_candidate = (ROOT_DIR / path).resolve()
        if root_candidate.exists():
            path = root_candidate
    if path.is_file():
        return str(path)
    if path.is_dir():
        for relative in ("bin/python", "bin/python3", "Scripts/python.exe", "Scripts/python"):
            maybe = path / relative
            if maybe.exists():
                return str(maybe)
    if path.exists():
        return str(path)
    return sys.executable


def _resolve_working_dir(source: IdentitySource) -> Path:
    candidate = (source.working_dir or "").strip()
    if not candidate:
        return ROOT_DIR
    path = Path(candidate).expanduser()
    if path.is_absolute():
        return path
    return (ROOT_DIR / path).resolve()


def _normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    employee_id = normalized.get("employee_id") or normalized.get("employee_key") or normalized.get("user_id") or normalized.get("member_id") or normalized.get("id")
    full_name = normalized.get("full_name") or normalized.get("name")
    email = normalized.get("email")
    if employee_id is None or full_name is None or email is None:
        missing = [field for field in REQUIRED_COLUMNS if not normalized.get(field)]
        raise ValueError(f"Missing required identity columns: {', '.join(missing)}")
    normalized["employee_id"] = str(employee_id).strip()
    normalized["full_name"] = str(full_name).strip()
    normalized["email"] = str(email).strip().lower()
    normalized["title"] = (normalized.get("title") or "").strip() or None
    normalized["org"] = (normalized.get("org") or "").strip() or None
    normalized["team"] = (normalized.get("team") or "").strip() or None
    normalized["site"] = (normalized.get("site") or "").strip() or None
    normalized["manager"] = (normalized.get("manager") or "").strip() or None
    normalized["roles"] = _ensure_list(normalized.get("roles"))
    normalized["permissions"] = _ensure_list(normalized.get("permissions"))
    status = str(normalized.get("status") or "active").strip().lower()
    normalized["status"] = "active" if status in ACTIVE_STATUSES else ("inactive" if status in INACTIVE_STATUSES else status or "active")
    return normalized


def _row_hash(row: dict[str, Any]) -> str:
    payload = {key: row.get(key) for key in ["employee_id", "full_name", "email", "title", "org", "team", "site", "manager", "roles", "permissions", "status"]}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode("utf-8")).hexdigest()


def _row_diff(previous: OrgMember | None, current: dict[str, Any]) -> list[str]:
    if not previous:
        return ["employee_id", "full_name", "email", "title", "org", "team", "site", "manager", "roles", "permissions", "status"]
    changed = []
    for field in ["full_name", "email", "title", "org", "team", "site", "manager", "roles", "permissions", "status", "employee_id"]:
        if getattr(previous, field, None) != current.get(field):
            changed.append(field)
    return changed


def _snapshot_payload(current: dict[str, Any], row_state: str, source_hash: str, previous_fields: list[str] | None = None) -> dict[str, Any]:
    payload = dict(current)
    payload["row_state"] = row_state
    payload["source_hash"] = source_hash
    if previous_fields:
        payload["changed_fields"] = previous_fields
    return payload


async def ensure_identity_source_defaults(db: AsyncSession) -> IdentitySource:
    result = await db.execute(select(IdentitySource))
    source = result.scalars().first()
    if source:
        return source
    defaults = get_default_identity_source()
    source = IdentitySource(**defaults)
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


async def load_identity_source(db: AsyncSession) -> dict[str, Any]:
    source = await ensure_identity_source_defaults(db)
    snapshot_result = await db.execute(
        select(IdentitySourceSnapshot)
        .where(IdentitySourceSnapshot.source_id == source.id)
        .order_by(IdentitySourceSnapshot.version.desc())
        .limit(20)
    )
    snapshots = snapshot_result.scalars().all()
    return {
        "source": source,
        "snapshots": snapshots,
    }


def _wrapper_code() -> str:
    return textwrap.dedent(
        """
        import json
        import runpy
        import sys
        from pathlib import Path

        def _emit(payload):
            print(json.dumps(payload, default=str))

        script_path = Path(sys.argv[1])
        namespace = runpy.run_path(str(script_path), run_name="__main__")
        candidate = None
        for key in ("result", "df", "output"):
            if key in namespace and namespace[key] is not None:
                candidate = namespace[key]
                break
        if candidate is None:
            for key in ("build_user_table", "build_identity_table", "main"):
                fn = namespace.get(key)
                if callable(fn):
                    candidate = fn()
                    break
        if candidate is None:
            _emit({"status": "error", "error": "No dataframe result was returned. Define `df`, `result`, or a table builder function."})
            raise SystemExit(2)
        if hasattr(candidate, "to_dict") and hasattr(candidate, "columns"):
            try:
                rows = candidate.to_dict(orient="records")
            except Exception:
                rows = candidate.to_dict()
        elif isinstance(candidate, list):
            rows = candidate
        elif hasattr(candidate, "to_dict"):
            try:
                rows = candidate.to_dict(orient="records")
            except Exception:
                rows = candidate.to_dict()
        else:
            _emit({"status": "error", "error": f"Unsupported return type: {type(candidate).__name__}"})
            raise SystemExit(3)
        _emit({"status": "success", "rows": rows})
        """
    ).strip()


async def _run_source_script(source: IdentitySource) -> tuple[list[dict[str, Any]], str | None]:
    script_content = (source.script_content or "").strip()
    if not script_content and source.script_path:
        script_path = Path(source.script_path)
        if not script_path.is_absolute():
            script_path = _resolve_working_dir(source) / script_path
        if script_path.exists():
            script_content = script_path.read_text(encoding="utf-8")
    if not script_content:
        return [], "No script content configured."

    working_dir = _resolve_working_dir(source)
    python_executable = _pick_python_executable(source)
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        script_path = tmpdir_path / "identity_source.py"
        wrapper_path = tmpdir_path / "identity_source_wrapper.py"
        script_path.write_text(script_content, encoding="utf-8")
        wrapper_path.write_text(_wrapper_code(), encoding="utf-8")
        process = await asyncio.create_subprocess_exec(
            python_executable,
            str(wrapper_path),
            str(script_path),
            cwd=str(working_dir),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PATHOS_IDENTITY_SOURCE": str(source.id),
            },
        )
        stdout, stderr = await process.communicate()
        combined = (stdout or b"").decode("utf-8", errors="replace").strip()
        if process.returncode != 0:
            message = stderr.decode("utf-8", errors="replace").strip() or combined or f"Identity source exited with code {process.returncode}"
            return [], message
        payload_line = combined.splitlines()[-1] if combined else ""
        try:
            payload = json.loads(payload_line)
        except Exception:
            return [], combined or "Identity source produced no JSON payload."
        if payload.get("status") != "success":
            return [], payload.get("error") or "Identity source execution failed."
        rows = payload.get("rows") or []
        if not isinstance(rows, list):
            return [], "Identity source returned a non-list rows payload."
        normalized_rows = []
        for raw_row in rows:
            if not isinstance(raw_row, dict):
                raise ValueError("Each identity row must be a dictionary-like object")
            normalized_rows.append(_normalize_row(raw_row))
        return normalized_rows, None


async def execute_identity_source(db: AsyncSession, actor: str = "system_user") -> dict[str, Any]:
    source = await ensure_identity_source_defaults(db)
    rows, execution_error = await _run_source_script(source)
    if execution_error:
        source.last_run_at = _now()
        source.last_run_status = "failed"
        source.last_run_message = execution_error
        await db.commit()
        return {
            "status": "failed",
            "message": execution_error,
            "source": source,
            "snapshot": None,
            "rows": [],
        }

    current_result = await db.execute(select(OrgMember).where(OrgMember.is_deleted == False))
    current_members = current_result.scalars().all()
    current_by_employee = {str(member.employee_id): member for member in current_members if getattr(member, "employee_id", None)}
    current_by_email = {member.email.lower(): member for member in current_members}
    seen_employee_ids: set[str] = set()
    touched_members: list[OrgMember] = []
    snapshot_rows: list[IdentitySourceSnapshotRow] = []
    added_count = 0
    updated_count = 0
    removed_count = 0
    diff_summary: list[dict[str, Any]] = []

    for row in rows:
        employee_id = row["employee_id"]
        existing = current_by_employee.get(employee_id) or current_by_email.get(row["email"])
        changed_fields = _row_diff(existing, row)
        row_state = "current"
        if existing:
            row_state = "updated" if changed_fields else "current"
            existing.full_name = row["full_name"]
            existing.email = row["email"]
            existing.employee_id = employee_id
            existing.title = row.get("title")
            existing.org = row.get("org")
            existing.team = row.get("team")
            existing.site = row.get("site")
            existing.manager = row.get("manager")
            existing.roles = row.get("roles", [])
            existing.permissions = row.get("permissions", [])
            existing.status = row["status"]
            existing.identity_status = row["status"]
            existing.identity_hash = _row_hash(row)
            existing.identity_source_id = source.id
            existing.last_synced_at = _now()
            if row_state == "updated":
                updated_count += 1
        else:
            row_state = "new"
            added_count += 1
            existing = OrgMember(
                full_name=row["full_name"],
                email=row["email"],
                employee_id=employee_id,
                title=row.get("title"),
                org=row.get("org"),
                team=row.get("team"),
                site=row.get("site"),
                manager=row.get("manager"),
                roles=row.get("roles", []),
                permissions=row.get("permissions", []),
                status=row["status"],
                identity_status=row["status"],
                identity_hash=_row_hash(row),
                identity_source_id=source.id,
                last_synced_at=_now(),
            )
            db.add(existing)
        if existing:
            touched_members.append(existing)
        seen_employee_ids.add(employee_id)
        snapshot_rows.append(
            IdentitySourceSnapshotRow(
                employee_id=employee_id,
                full_name=row["full_name"],
                email=row["email"],
                title=row.get("title"),
                org=row.get("org"),
                team=row.get("team"),
                site=row.get("site"),
                manager=row.get("manager"),
                roles=row.get("roles", []),
                permissions=row.get("permissions", []),
                status=row["status"],
                row_state=row_state,
                source_hash=_row_hash(row),
                payload=_snapshot_payload(row, row_state, _row_hash(row), changed_fields if changed_fields else None),
            )
        )
        if changed_fields:
            diff_summary.append({"employee_id": employee_id, "row_state": row_state, "changed_fields": changed_fields})

    for member in current_members:
        if member.employee_id and str(member.employee_id) in seen_employee_ids:
            continue
        if member.status != "inactive":
            removed_count += 1
            member.status = "inactive"
            member.identity_status = "inactive"
            member.last_synced_at = _now()
            member.identity_source_id = source.id
            touched_members.append(member)
            snapshot_rows.append(
                IdentitySourceSnapshotRow(
                    employee_id=str(member.employee_id or member.email),
                    full_name=member.full_name,
                    email=member.email,
                    title=member.title,
                    org=member.org,
                    team=member.team,
                    site=member.site,
                    manager=member.manager,
                    roles=member.roles or [],
                    permissions=member.permissions or [],
                    status="inactive",
                    row_state="removed",
                    source_hash=member.identity_hash,
                    payload={
                        "employee_id": member.employee_id,
                        "full_name": member.full_name,
                        "email": member.email,
                        "title": member.title,
                        "org": member.org,
                        "team": member.team,
                        "site": member.site,
                        "manager": member.manager,
                        "roles": member.roles or [],
                        "permissions": member.permissions or [],
                        "status": "inactive",
                        "row_state": "removed",
                        "source_hash": member.identity_hash,
                    },
                )
            )

    next_version = (source.current_version or 0) + 1
    source_hash = hashlib.sha256(
        json.dumps(sorted([row["employee_id"] + ":" + _row_hash(row) for row in rows]), sort_keys=True).encode("utf-8")
    ).hexdigest()
    snapshot = IdentitySourceSnapshot(
        source_id=source.id,
        version=next_version,
        actor=actor,
        status="success",
        message=f"Synced {len(rows)} active rows.",
        row_count=len(rows),
        added_count=added_count,
        updated_count=updated_count,
        removed_count=removed_count,
        source_hash=source_hash,
        diff_summary={"changes": diff_summary, "added_count": added_count, "updated_count": updated_count, "removed_count": removed_count},
    )
    db.add(snapshot)
    await db.flush()
    for member in touched_members:
        member.identity_snapshot_id = snapshot.id
    for snapshot_row in snapshot_rows:
        snapshot_row.snapshot_id = snapshot.id
        db.add(snapshot_row)
    source.current_snapshot_id = snapshot.id
    source.current_version = next_version
    source.last_run_at = _now()
    source.last_run_status = "success"
    source.last_run_message = f"Synced {len(rows)} current rows; {added_count} added, {updated_count} updated, {removed_count} retired."
    source.last_run_row_count = len(rows)
    await db.commit()
    await db.refresh(source)
    await db.refresh(snapshot)
    return {
        "status": "success",
        "message": source.last_run_message,
        "source": source,
        "snapshot": snapshot,
        "rows": rows,
    }
