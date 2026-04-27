import asyncio
import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker, selectinload

if os.getcwd() not in sys.path:
    sys.path.append(os.getcwd())

from app.database import Base, DATABASE_URL
from app.models.models import (
    AppConfig,
    AuditLog,
    AutomationProject,
    AutomationStatus,
    Blocker,
    OrgMember,
    ParameterLog,
    SavedView,
    SystemParameter,
    Task,
    TaskError,
    TaxonomyEnum,
    Workflow,
    WorkflowExecution,
)
from app.core.metrics import update_workflow_roi
from app.runtime_defaults import get_default_org_members, get_parameter_seed_defaults, get_rollout_default_configs


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


WORKFLOW_TEMPLATES = [
    {
        "name": "Metrology Shift Handoff Control",
        "workspace": "Standard Operations",
        "status": AutomationStatus.PARTIALLY_AUTOMATED.value,
        "workflow_type": "Shift Handoff",
        "prc": "PRC-MET-110",
        "tool_family": "Overlay, CD-SEM",
        "tool_id": "OVL_01, CDSEM_02",
        "org": "Metrology",
        "team": "Process Control",
        "poc": "Haewon Kim",
        "description": "Operator-to-operator handoff covering tool state, exceptions, and release readiness.",
        "trigger_type": "Schedule",
        "trigger_description": "Shift change requires a standardized handoff and readiness review.",
        "cadence_count": 21.0,
        "cadence_unit": "week",
        "output_type": "Checklist",
        "output_description": "Signed handoff summary with risks and pending actions.",
        "repeatability_check": True,
        "equipment_required": True,
        "equipment_state": "Idle",
        "cleanroom_required": True,
        "quick_capture_notes": "Use as the standard handoff pattern across tool families.",
        "template_key": "metrology-shift-handoff",
        "ownership": {
            "owner": "Haewon Kim",
            "smes": ["Metrology SME", "Shift Lead"],
            "backup_owners": ["Automation Team"],
            "automation_owner": "Automation Team",
            "reviewers": ["Quality Reviewer"],
        },
        "governance": {
            "lifecycle_stage": "Active",
            "review_state": "Approved",
            "approval_state": "Certified",
            "required_reviewer_roles": ["Shift Lead", "Metrology SME"],
            "standards_flags": ["handoff", "validation", "ownership"],
            "stale_after_days": 45,
            "review_due_at": (utc_now() + timedelta(days=20)).date().isoformat(),
            "last_reviewed_at": (utc_now() - timedelta(days=10)).isoformat(),
        },
        "review_state": "Approved",
        "approval_state": "Certified",
        "required_reviewer_roles": ["Shift Lead", "Metrology SME"],
        "review_requests": [
            {"id": "handoff-review-1", "role": "Shift Lead", "requested_by": "Haewon Kim", "requested_from": "Shift Lead", "status": "approved", "due_at": (utc_now() - timedelta(days=5)).date().isoformat(), "note": "Initial rollout review complete."}
        ],
        "activity_timeline": [
            {"id": "activity-1", "type": "workflow.created", "message": "Workflow created for department-standard handoff control.", "actor": "haewon.kim@company.example", "created_at": (utc_now() - timedelta(days=40)).isoformat()},
            {"id": "activity-2", "type": "governance.certify", "message": "Certified for department use.", "actor": "quality.reviewer@company.example", "created_at": (utc_now() - timedelta(days=10)).isoformat()},
        ],
        "notification_feed": [
            {"id": "notif-handoff-1", "kind": "governance-action", "title": "Workflow certified", "detail": "This workflow is certified and ready for broad department use.", "read": False, "created_at": (utc_now() - timedelta(days=10)).isoformat()},
        ],
        "comments": [
            {"id": "comment-1", "scope": "workflow", "author": "Haewon Kim", "message": "Use this as the cross-team baseline for shift transitions.", "mentions": ["@Automation Team"], "created_at": (utc_now() - timedelta(days=12)).isoformat(), "resolved": False},
        ],
        "tasks": [
            {
                "node_id": "handoff-trigger",
                "name": "Trigger",
                "task_type": "TRIGGER",
                "description": "Shift change occurs.",
                "interface": "TRIGGER",
                "manual_time_minutes": 0.0,
                "automation_time_minutes": 0.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "phase_name": "Intake",
                "source_data_list": [],
                "output_data_list": [{"id": "handoff-shift", "name": "Shift State"}],
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
            {
                "node_id": "handoff-verify",
                "name": "Verify Tool State",
                "task_type": "Verification",
                "description": "Validate last run state, alarms, consumables, and readiness before handoff.",
                "target_systems": [{"id": "tool-console", "name": "Tool Console", "usage": "State verification"}],
                "manual_time_minutes": 12.0,
                "automation_time_minutes": 3.0,
                "machine_wait_time_minutes": 2.0,
                "occurrence": 1,
                "validation_needed": True,
                "validation_procedure": "Review alarms and confirm readiness checklist.",
                "verification_steps": [{"id": "verify-2", "description": "Confirm tool is released or document hold reason."}],
                "source_data_list": [{"id": "src-shift", "name": "Shift State", "from_task_id": "handoff-shift"}],
                "output_data_list": [{"id": "handoff-status", "name": "Verified Tool Status"}],
                "phase_name": "Verification",
                "subflow_name": "Shift Control",
                "task_block_key": "shift-verify",
                "owner_positions": ["Technician", "Shift Lead"],
                "reference_links": [{"id": "ref-handoff", "url": "https://internal/wiki/handoff", "label": "Handoff SOP"}],
                "instructions": [{"id": "inst-1", "description": "Capture hold reason if the tool cannot be released."}],
                "media": [{"id": "media-1", "type": "image", "url": "/uploads/sample-handoff.png", "label": "Reference screen"}],
                "blockers": [
                    {"blocking_entity": "Facilities", "reason": "Gas pressure drift requires escalation.", "probability_percent": 18.0, "average_delay_minutes": 45.0, "standard_mitigation": "Escalate to facilities and hold the tool."}
                ],
                "errors": [
                    {"error_type": "Missed Alarm", "description": "Alarm state not reviewed during handoff.", "probability_percent": 8.0, "recovery_time_minutes": 20.0, "correction_method": "Return to console and update the checklist."}
                ],
            },
            {
                "node_id": "handoff-outcome",
                "name": "Outcome",
                "task_type": "OUTCOME",
                "description": "Signed handoff package published.",
                "interface": "OUTCOME",
                "manual_time_minutes": 0.0,
                "automation_time_minutes": 0.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "phase_name": "Outcome",
                "source_data_list": [{"id": "src-status", "name": "Verified Tool Status", "from_task_id": "handoff-status"}],
                "output_data_list": [],
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
        ],
        "edges": [
            {"id": "edge-h1", "source": "handoff-trigger", "target": "handoff-verify", "label": ""},
            {"id": "edge-h2", "source": "handoff-verify", "target": "handoff-outcome", "label": ""},
        ],
    },
    {
        "name": "Scatterometry Automation Candidate Study",
        "workspace": "Collaborative Workflows",
        "status": AutomationStatus.AUTOMATION_PLANNED.value,
        "workflow_type": "Automation Study",
        "prc": "PRC-MET-210",
        "tool_family": "Scatterometry",
        "tool_id": "SCAT_03",
        "org": "Metrology",
        "team": "Factory Automation",
        "poc": "Automation Team",
        "description": "Capture current-state manual burden, validation, and exception handling before automation scope approval.",
        "trigger_type": "Request",
        "trigger_description": "Repeated manual scatterometry review is nominated for automation.",
        "cadence_count": 6.0,
        "cadence_unit": "week",
        "output_type": "Recommendation",
        "output_description": "Automation-ready workflow definition with ROI and risks.",
        "repeatability_check": True,
        "equipment_required": True,
        "equipment_state": "Run",
        "cleanroom_required": False,
        "quick_capture_notes": "Strong candidate for automation because manual triage is repetitive and exception-heavy.",
        "template_key": "automation-candidate-study",
        "ownership": {
            "owner": "Automation Team",
            "smes": ["Metrology SME"],
            "backup_owners": ["Process Owner"],
            "automation_owner": "Automation Team",
            "reviewers": ["Process Owner", "Quality Reviewer"],
        },
        "governance": {
            "lifecycle_stage": "In Review",
            "review_state": "Requested",
            "approval_state": "Draft",
            "required_reviewer_roles": ["Automation Team", "Process Owner"],
            "standards_flags": ["roi", "exceptions", "automation-ready"],
            "stale_after_days": 60,
            "review_due_at": (utc_now() + timedelta(days=4)).date().isoformat(),
            "last_reviewed_at": "",
        },
        "review_state": "Requested",
        "approval_state": "Draft",
        "required_reviewer_roles": ["Automation Team", "Process Owner"],
        "review_requests": [
            {"id": "study-review-1", "role": "Process Owner", "requested_by": "Automation Team", "requested_from": "Process Owner", "status": "open", "due_at": (utc_now() + timedelta(days=4)).date().isoformat(), "note": "Need signoff on ROI assumptions and validation."}
        ],
        "activity_timeline": [
            {"id": "activity-study-1", "type": "workflow.created", "message": "Automation study initiated from candidate queue.", "actor": "automation.team@company.example", "created_at": (utc_now() - timedelta(days=8)).isoformat()},
        ],
        "notification_feed": [
            {"id": "notif-study-1", "kind": "review-request", "title": "Process Owner review required", "detail": "ROI and validation assumptions need confirmation.", "read": False, "created_at": (utc_now() - timedelta(days=1)).isoformat()},
        ],
        "comments": [
            {"id": "comment-study-1", "scope": "workflow", "author": "Automation Team", "message": "The manual triage path still depends on tribal knowledge in the exception branch.", "mentions": ["@Metrology SME"], "created_at": (utc_now() - timedelta(days=2)).isoformat(), "resolved": False, "assignee": "Metrology SME", "review_state": "open"},
        ],
        "tasks": [
            {
                "node_id": "study-trigger",
                "name": "Trigger",
                "task_type": "TRIGGER",
                "description": "Automation nomination is raised.",
                "interface": "TRIGGER",
                "manual_time_minutes": 0.0,
                "automation_time_minutes": 0.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "phase_name": "Current State",
                "source_data_list": [],
                "output_data_list": [{"id": "nomination", "name": "Automation Nomination"}],
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
            {
                "node_id": "study-manual",
                "name": "Manual Review",
                "task_type": "Hands-on",
                "description": "Technician manually reviews wafer signatures and logs exceptions.",
                "target_systems": [{"id": "scat-console", "name": "Scatterometry Console", "usage": "Review"}],
                "manual_time_minutes": 25.0,
                "automation_time_minutes": 4.0,
                "machine_wait_time_minutes": 6.0,
                "occurrence": 1,
                "source_data_list": [{"id": "src-nomination", "name": "Automation Nomination", "from_task_id": "nomination"}],
                "output_data_list": [{"id": "review-packet", "name": "Review Packet"}],
                "phase_name": "Current State",
                "subflow_name": "Manual Triage",
                "owner_positions": ["Technician"],
                "reference_links": [{"id": "ref-study", "url": "https://internal/wiki/scat-study", "label": "Study Notes"}],
                "instructions": [{"id": "inst-study-1", "description": "Record the manual choices that would need automation rules."}],
                "media": [{"id": "media-study-1", "type": "pdf", "url": "/uploads/scat-study.pdf", "label": "Historic study"}],
                "blockers": [],
                "errors": [{"error_type": "Rework", "description": "Packet needs reclassification after SME feedback.", "probability_percent": 22.0, "recovery_time_minutes": 35.0, "correction_method": "Re-run review and update notes."}],
            },
            {
                "node_id": "study-decision",
                "name": "Decision",
                "task_type": "DECISION",
                "description": "Check whether the workflow can be automated safely with current exception coverage.",
                "manual_time_minutes": 8.0,
                "automation_time_minutes": 1.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "source_data_list": [{"id": "src-packet", "name": "Review Packet", "from_task_id": "review-packet"}],
                "output_data_list": [{"id": "study-gate", "name": "Automation Gate"}],
                "phase_name": "Decision",
                "decision_details": {"question": "Is exception coverage strong enough to proceed?", "routes": ["True", "False"]},
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
            {
                "node_id": "study-outcome",
                "name": "Outcome",
                "task_type": "OUTCOME",
                "description": "Automation recommendation published.",
                "interface": "OUTCOME",
                "manual_time_minutes": 0.0,
                "automation_time_minutes": 0.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "phase_name": "Outcome",
                "source_data_list": [{"id": "src-gate", "name": "Automation Gate", "from_task_id": "study-gate"}],
                "output_data_list": [],
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
        ],
        "edges": [
            {"id": "edge-s1", "source": "study-trigger", "target": "study-manual", "label": ""},
            {"id": "edge-s2", "source": "study-manual", "target": "study-decision", "label": ""},
            {"id": "edge-s3", "source": "study-decision", "target": "study-outcome", "label": "True"},
        ],
    },
    {
        "name": "Reticle Alert Exception Recovery",
        "workspace": "Personal Drafts",
        "status": AutomationStatus.WORKFLOW_REVIEW.value,
        "workflow_type": "Exception Response",
        "prc": "PRC-MET-320",
        "tool_family": "Reticle Inspection",
        "tool_id": "RET_02",
        "org": "Metrology",
        "team": "Yield Engineering",
        "poc": "Yield Engineering",
        "description": "Draft workflow for handling reticle alert escalations with incomplete exception standards.",
        "trigger_type": "Alarm",
        "trigger_description": "Reticle system raises a repeating alert that must be triaged.",
        "cadence_count": 3.0,
        "cadence_unit": "week",
        "output_type": "Resolution",
        "output_description": "Reticle alert resolved or escalated with documented root cause.",
        "repeatability_check": True,
        "equipment_required": True,
        "equipment_state": "Down",
        "cleanroom_required": False,
        "quick_capture_notes": "Still rough and should surface stale/review signals.",
        "ownership": {
            "owner": "Yield Engineering",
            "smes": ["Metrology SME"],
            "backup_owners": [],
            "automation_owner": "",
            "reviewers": [],
        },
        "governance": {
            "lifecycle_stage": "Draft",
            "review_state": "Draft",
            "approval_state": "Draft",
            "required_reviewer_roles": ["Metrology SME"],
            "standards_flags": ["exceptions"],
            "stale_after_days": 20,
            "review_due_at": (utc_now() - timedelta(days=2)).date().isoformat(),
            "last_reviewed_at": (utc_now() - timedelta(days=50)).isoformat(),
        },
        "review_state": "Draft",
        "approval_state": "Draft",
        "required_reviewer_roles": ["Metrology SME"],
        "review_requests": [],
        "activity_timeline": [
            {"id": "activity-alert-1", "type": "workflow.created", "message": "Draft created from operator notes.", "actor": "yield.engineering@company.example", "created_at": (utc_now() - timedelta(days=60)).isoformat()},
        ],
        "notification_feed": [
            {"id": "notif-alert-1", "kind": "stale-warning", "title": "Workflow looks stale", "detail": "This draft has not been reviewed against current reticle behavior.", "read": False, "created_at": (utc_now() - timedelta(days=1)).isoformat()},
        ],
        "comments": [],
        "tasks": [
            {
                "node_id": "alert-trigger",
                "name": "Trigger",
                "task_type": "TRIGGER",
                "description": "Reticle alert fires.",
                "interface": "TRIGGER",
                "manual_time_minutes": 0.0,
                "automation_time_minutes": 0.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "phase_name": "Alert",
                "source_data_list": [],
                "output_data_list": [{"id": "alert-payload", "name": "Alert Payload"}],
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
            {
                "node_id": "alert-recover",
                "name": "Manual Recovery",
                "task_type": "System Interaction",
                "description": "Engineer manually triages the alert and attempts recovery.",
                "target_systems": [{"id": "ret-console", "name": "Reticle Console", "usage": "Recovery"}],
                "manual_time_minutes": 35.0,
                "automation_time_minutes": 10.0,
                "machine_wait_time_minutes": 8.0,
                "occurrence": 1,
                "source_data_list": [{"id": "src-alert", "name": "Alert Payload", "from_task_id": "alert-payload"}],
                "output_data_list": [{"id": "alert-resolution", "name": "Resolution Packet"}],
                "phase_name": "Recovery",
                "owner_positions": ["Engineer"],
                "reference_links": [],
                "instructions": [{"id": "inst-alert", "description": "Document tribal steps that are not yet in the SOP."}],
                "media": [],
                "blockers": [{"blocking_entity": "SME", "reason": "Only one SME knows the escalation path.", "probability_percent": 35.0, "average_delay_minutes": 90.0, "standard_mitigation": "Page Metrology SME and document the branch."}],
                "errors": [{"error_type": "Escalation Delay", "description": "Recovery stalls waiting for SME approval.", "probability_percent": 28.0, "recovery_time_minutes": 55.0, "correction_method": "Escalate and document the reason."}],
            },
            {
                "node_id": "alert-outcome",
                "name": "Outcome",
                "task_type": "OUTCOME",
                "description": "Reticle alert resolution logged.",
                "interface": "OUTCOME",
                "manual_time_minutes": 0.0,
                "automation_time_minutes": 0.0,
                "machine_wait_time_minutes": 0.0,
                "occurrence": 1,
                "phase_name": "Outcome",
                "source_data_list": [{"id": "src-resolution", "name": "Resolution Packet", "from_task_id": "alert-resolution"}],
                "output_data_list": [],
                "reference_links": [],
                "instructions": [],
                "media": [],
                "blockers": [],
                "errors": [],
            },
        ],
        "edges": [
            {"id": "edge-a1", "source": "alert-trigger", "target": "alert-recover", "label": ""},
            {"id": "edge-a2", "source": "alert-recover", "target": "alert-outcome", "label": ""},
        ],
    },
]


async def seed_data():
    sync_engine = create_engine(DATABASE_URL.replace("sqlite+aiosqlite", "sqlite"))
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()

    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        for model in [AuditLog, ParameterLog, SavedView, WorkflowExecution, AutomationProject, Blocker, TaskError, Task, Workflow, TaxonomyEnum, SystemParameter, OrgMember, AppConfig]:
            await session.execute(delete(model))
        await session.commit()

        parameters = [
            SystemParameter(
                key=definition["key"],
                label=definition.get("label", definition["key"]),
                description=definition.get("description"),
                is_dynamic=False,
                manual_values=definition.get("values", []),
                cached_values=definition.get("values", []),
            )
            for definition in get_parameter_seed_defaults()
        ]
        session.add_all(parameters)

        taxonomy = [
            TaxonomyEnum(category="TriggerType", label="Schedule", value="schedule"),
            TaxonomyEnum(category="TriggerType", label="Request", value="request"),
            TaxonomyEnum(category="TriggerType", label="Alarm", value="alarm"),
            TaxonomyEnum(category="OutputType", label="Checklist", value="checklist"),
            TaxonomyEnum(category="OutputType", label="Recommendation", value="recommendation"),
            TaxonomyEnum(category="OutputType", label="Resolution", value="resolution"),
            TaxonomyEnum(category="ToolType", label="Overlay", value="overlay"),
            TaxonomyEnum(category="ToolType", label="CD-SEM", value="cd-sem"),
            TaxonomyEnum(category="ToolType", label="Scatterometry", value="scatterometry"),
            TaxonomyEnum(category="ToolType", label="Reticle Inspection", value="reticle-inspection"),
        ]
        session.add_all(taxonomy)

        members = [OrgMember(**payload) for payload in get_default_org_members()]
        session.add_all(members)

        configs = [AppConfig(key=key, label=value["label"], description=value["description"], value=value["value"]) for key, value in get_rollout_default_configs().items()]
        session.add_all(configs)

        workflows = []
        for definition in WORKFLOW_TEMPLATES:
            tasks_data = definition.pop("tasks")
            edges = definition.pop("edges")
            workflow = Workflow(**definition, edges=edges)
            session.add(workflow)
            await session.flush()
            for index, task_data in enumerate(tasks_data):
                blockers = task_data.pop("blockers", [])
                errors = task_data.pop("errors", [])
                task = Task(workflow_id=workflow.id, order_index=index, **task_data)
                session.add(task)
                await session.flush()
                for blocker in blockers:
                    session.add(Blocker(task_id=task.id, **blocker))
                for error in errors:
                    session.add(TaskError(task_id=task.id, **error))
            await session.flush()
            refreshed = await session.execute(
                select(Workflow)
                .where(Workflow.id == workflow.id)
                .options(
                    selectinload(Workflow.tasks).selectinload(Task.errors),
                    selectinload(Workflow.tasks).selectinload(Task.blockers),
                )
            )
            workflow_loaded = refreshed.scalar_one()
            await update_workflow_roi(workflow_loaded)
            workflows.append(workflow_loaded)

        saved_views = [
            SavedView(entity_type="workflow", name="Company Review Queue", owner_email="haewon.kim@company.example", scope="shared", search_text="review approval stale", filters={"status": ["Workflow Review", "Verification"]}, active_ribbon="Collaborative Workflows", view_mode="active", shared_with_roles=["reviewer"], shared_with_teams=["Process Control", "Factory Automation"]),
            SavedView(entity_type="project", name="Deployment Watchlist", owner_email="automation.team@company.example", scope="team", search_text="deployed validation blocked", filters={"status": ["Validation", "Deployed"]}, active_ribbon="Automation", view_mode="pipeline", shared_with_roles=["automation_engineer"], shared_with_teams=["Factory Automation"]),
        ]
        session.add_all(saved_views)
        await session.flush()

        executions = [
            WorkflowExecution(
                workflow_id=workflows[0].id,
                workflow_version=workflows[0].version,
                workflow_name_snapshot=workflows[0].name,
                automation_status_snapshot=workflows[0].status,
                execution_started_at=utc_now() - timedelta(days=1, hours=2),
                execution_completed_at=utc_now() - timedelta(days=1, hours=1, minutes=30),
                executed_by="Haewon Kim",
                team="Process Control",
                site="ATX",
                status="Completed",
                actual_duration_minutes=11.0,
                baseline_manual_minutes=18.0,
                automated_duration_minutes=4.0,
                wait_duration_minutes=2.0,
                recovery_time_minutes=0.0,
                exception_count=0,
                automation_coverage_percent=55.0,
                blockers_encountered=[],
                notes="Standard handoff completed cleanly.",
            ),
            WorkflowExecution(
                workflow_id=workflows[1].id,
                workflow_version=workflows[1].version,
                workflow_name_snapshot=workflows[1].name,
                automation_status_snapshot=workflows[1].status,
                execution_started_at=utc_now() - timedelta(days=2, hours=3),
                execution_completed_at=utc_now() - timedelta(days=2, hours=2),
                executed_by="Automation Team",
                team="Factory Automation",
                site="ATX",
                status="Completed",
                actual_duration_minutes=31.0,
                baseline_manual_minutes=43.0,
                automated_duration_minutes=8.0,
                wait_duration_minutes=6.0,
                recovery_time_minutes=12.0,
                exception_count=2,
                automation_coverage_percent=42.0,
                blockers_encountered=["ROI assumptions needed SME review"],
                notes="Useful for before/after automation candidate measurement.",
            ),
            WorkflowExecution(
                workflow_id=workflows[2].id,
                workflow_version=workflows[2].version,
                workflow_name_snapshot=workflows[2].name,
                automation_status_snapshot=workflows[2].status,
                execution_started_at=utc_now() - timedelta(days=4, hours=1),
                execution_completed_at=utc_now() - timedelta(days=4),
                executed_by="Yield Engineering",
                team="Yield Engineering",
                site="ATX",
                status="Completed",
                actual_duration_minutes=47.0,
                baseline_manual_minutes=35.0,
                automated_duration_minutes=10.0,
                wait_duration_minutes=8.0,
                recovery_time_minutes=25.0,
                exception_count=3,
                automation_coverage_percent=20.0,
                blockers_encountered=["SME escalation delay"],
                notes="Exception-heavy draft execution used to stress analytics and hotspot reporting.",
            ),
        ]
        session.add_all(executions)

        projects = [
            AutomationProject(
                name="Shift Handoff Standardization Rollout",
                workflow_ids=[workflows[0].id],
                summary="Expand the certified handoff pattern across similar metrology tools.",
                owner="Automation Team",
                sponsor="Metrology Leadership",
                team="Factory Automation",
                priority="High",
                status="Deployed",
                health="On Track",
                progress_percent=100.0,
                projected_hours_saved_weekly=6.5,
                realized_hours_saved_weekly=5.2,
                blocker_summary=[],
                milestone_summary=["Pilot Complete", "Department Rollout Complete"],
                traceability={"source_workflow_id": workflows[0].id, "validation_plan": "Compare execution logs before and after rollout."},
                benefits_realization={"realization_note": "Measured against 3 weeks of shift logs."},
                exception_governance={"top_exception_nodes": ["handoff-verify"]},
                delivery_metrics={"readiness": 85.0, "standardization": 90.0, "complexity_risk": 28.0},
                next_action="Prepare company-wide reuse package.",
                last_update="Department rollout complete with measurable benefit.",
            ),
            AutomationProject(
                name="Scatterometry Review Automation",
                workflow_ids=[workflows[1].id],
                summary="Automate the repetitive scatterometry review path and keep exception governance visible.",
                owner="Automation Team",
                sponsor="Automation Leadership",
                team="Factory Automation",
                priority="High",
                status="Validation",
                health="At Risk",
                progress_percent=72.0,
                projected_hours_saved_weekly=9.0,
                realized_hours_saved_weekly=0.0,
                blocker_summary=["Need final Process Owner validation on exception rules."],
                milestone_summary=["Workflow mapped", "Rules drafted", "Validation in progress"],
                traceability={"source_workflow_id": workflows[1].id, "source_workflow_version": workflows[1].version, "validation_plan": "Run side-by-side with manual review packet."},
                benefits_realization={"realization_note": "No realized value until validation closes."},
                exception_governance={"top_exception_nodes": ["study-manual"]},
                delivery_metrics={"readiness": 78.0, "standardization": 73.0, "complexity_risk": 48.0},
                next_action="Close validation on exception coverage with Process Owner.",
                last_update="Validation still blocked on review signoff.",
            ),
        ]
        session.add_all(projects)

        session.add(
            AuditLog(
                user_id="haewon.kim@company.example",
                action_type="SEED",
                table_name="workflows",
                record_id=workflows[0].id,
                description="Seeded current-schema workflow dataset for local development and manual testing.",
            )
        )

        await session.commit()

        print(f"Seed complete: {len(workflows)} workflows, {len(executions)} executions, {len(projects)} projects.")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed PathOS with profile-aware starter data.")
    parser.add_argument("--profile", dest="profile", default=None, help="Optional PATHOS_PROFILE name to apply before seeding.")
    args = parser.parse_args()
    if args.profile:
        os.environ["PATHOS_PROFILE"] = args.profile
    asyncio.run(seed_data())
