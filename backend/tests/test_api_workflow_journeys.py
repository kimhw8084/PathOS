from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.main import app


@pytest_asyncio.fixture
async def api_client(tmp_path: Path):
    db_path = tmp_path / "test-pathos.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}", connect_args={"check_same_thread": False})
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()
    await engine.dispose()


def workflow_payload():
    return {
        "name": "Inline Metrology Check",
        "description": "Capture a valid workflow through the API journey test.",
        "workspace": "Personal Drafts",
        "prc": "PRC-API",
        "workflow_type": "Verification",
        "org": "Operations",
        "team": "Yield Engineering",
        "trigger_type": "Schedule",
        "trigger_description": "Shift start",
        "output_type": "Report",
        "output_description": "Verification complete",
        "cadence_count": 1.0,
        "cadence_unit": "week",
        "tool_family": "Overlay",
        "tool_id": "OVL-12",
        "repeatability_check": True,
        "equipment_required": True,
        "equipment_state": "Ready",
        "cleanroom_required": False,
        "ownership": {
            "owner": "Haewon Kim",
            "smes": ["Metrology SME"],
            "backup_owners": ["Automation Team"],
            "automation_owner": "Automation Team",
            "reviewers": ["Yield Engineering"],
        },
        "governance": {
            "lifecycle_stage": "Draft",
            "review_state": "Requested",
            "approval_state": "Draft",
            "required_reviewer_roles": ["Metrology SME", "Automation Team"],
            "standards_flags": ["handoff"],
            "stale_after_days": 45,
            "review_due_at": "2026-05-01",
            "last_reviewed_at": "",
        },
        "review_requests": [{"id": "review-1", "role": "Metrology SME", "requested_by": "Haewon Kim", "status": "open", "due_at": "2026-05-01"}],
        "access_control": {
            "visibility": "private",
            "viewers": [],
            "editors": ["Automation Team"],
            "mention_groups": ["Metrology SME"],
            "owner": "Haewon Kim",
        },
        "comments": [{"scope": "workflow", "message": "Initial draft comment"}],
        "tasks": [],
        "edges": [],
    }


def workflow_tasks():
    return [
        {
            "workflow_id": 0,
            "node_id": "node-trigger",
            "name": "Trigger",
            "description": "Workflow start",
            "task_type": "TRIGGER",
            "interface": "TRIGGER",
            "manual_time_minutes": 0.0,
            "automation_time_minutes": 0.0,
            "machine_wait_time_minutes": 0.0,
            "occurrence": 1,
            "source_data_list": [],
            "output_data_list": [{"id": "output-trigger", "name": "Carrier Lot"}],
            "verification_steps": [],
            "blockers": [],
            "errors": [],
            "media": [],
            "reference_links": [],
            "instructions": [],
            "owner_positions": [],
            "target_systems": [],
        },
        {
            "workflow_id": 0,
            "node_id": "node-task",
            "name": "Measure Wafer",
            "description": "Measure target wafer and log the result.",
            "task_type": "System Interaction",
            "manual_time_minutes": 12.0,
            "automation_time_minutes": 2.0,
            "machine_wait_time_minutes": 3.0,
            "occurrence": 1,
            "source_data_list": [{"id": "input-1", "name": "Carrier Lot", "from_task_id": "output-trigger"}],
            "output_data_list": [{"id": "output-task", "name": "Measurement Result"}],
            "verification_steps": [{"id": "step-1", "description": "Verify the reading is within spec."}],
            "validation_needed": True,
            "validation_procedure_steps": [{"id": "step-1", "description": "Verify the reading is within spec."}],
            "blockers": [],
            "errors": [
                {
                    "error_type": "Retry",
                    "description": "Measurement retry required",
                    "probability_percent": 10.0,
                    "recovery_time_minutes": 5.0,
                }
            ],
            "media": [{"id": "asset-1", "type": "image", "url": "/uploads/demo.png", "label": "Reference"}],
            "reference_links": [{"id": "ref-1", "url": "https://internal/wiki/metrology", "label": "Wiki"}],
            "instructions": [{"id": "instruction-1", "description": "Wear gloves before handling the wafer."}],
            "owner_positions": ["Technician"],
            "target_systems": [{"id": "sys-1", "name": "Metrology Console", "usage": "Acquisition"}],
        },
        {
            "workflow_id": 0,
            "node_id": "node-outcome",
            "name": "Outcome",
            "description": "Workflow complete",
            "task_type": "OUTCOME",
            "interface": "OUTCOME",
            "manual_time_minutes": 0.0,
            "automation_time_minutes": 0.0,
            "machine_wait_time_minutes": 0.0,
            "occurrence": 1,
            "source_data_list": [{"id": "input-2", "name": "Measurement Result", "from_task_id": "output-task"}],
            "output_data_list": [],
            "verification_steps": [],
            "blockers": [],
            "errors": [],
            "media": [],
            "reference_links": [],
            "instructions": [],
            "owner_positions": [],
            "target_systems": [],
        },
    ]


@pytest.mark.asyncio
async def test_workflow_create_update_and_reload_round_trip(api_client: AsyncClient):
    create_response = await api_client.post("/api/workflows", json=workflow_payload())
    assert create_response.status_code == 200, create_response.text
    created = create_response.json()
    workflow_id = created["id"]

    payload = workflow_payload()
    payload["name"] = "Inline Metrology Check v2"
    payload["version_notes"] = "Expanded through API integration test"
    payload["tasks"] = workflow_tasks()
    payload["edges"] = [
        {"source": "node-trigger", "target": "node-task", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]

    update_response = await api_client.put(f"/api/workflows/{workflow_id}", json=payload)
    assert update_response.status_code == 200, update_response.text
    updated = update_response.json()

    assert updated["name"] == "Inline Metrology Check v2"
    assert updated["org"] == "Operations"
    assert updated["team"] == "Yield Engineering"
    assert len(updated["tasks"]) == 3
    assert len(updated["edges"]) == 2
    assert updated["analysis"]["has_cycle"] is False
    assert updated["analysis"]["critical_path_minutes"] > 0
    assert updated["total_roi_saved_hours"] > 0
    assert updated["tasks"][1]["errors"][0]["error_type"] == "Retry"
    assert updated["tasks"][1]["instructions"][0]["description"].startswith("Wear gloves")

    reload_response = await api_client.get(f"/api/workflows/{workflow_id}")
    assert reload_response.status_code == 200, reload_response.text
    reloaded = reload_response.json()
    assert reloaded["org"] == "Operations"
    assert reloaded["team"] == "Yield Engineering"
    assert reloaded["version_notes"] == "Expanded through API integration test"
    assert reloaded["analysis"]["critical_path_minutes"] == updated["analysis"]["critical_path_minutes"]
    assert reloaded["tasks"][1]["reference_links"][0]["url"] == "https://internal/wiki/metrology"
    assert reloaded["ownership"]["automation_owner"] == "Automation Team"
    assert reloaded["governance"]["required_reviewer_roles"] == ["Metrology SME", "Automation Team"]
    assert len(reloaded["activity_timeline"]) >= 1


@pytest.mark.asyncio
async def test_workflow_update_rejects_malformed_decision_routes(api_client: AsyncClient):
    create_response = await api_client.post("/api/workflows", json=workflow_payload())
    assert create_response.status_code == 200, create_response.text
    workflow_id = create_response.json()["id"]

    invalid_payload = workflow_payload()
    invalid_payload["tasks"] = [
        {
            "workflow_id": 0,
            "node_id": "node-trigger",
            "name": "Trigger",
            "description": "Workflow start",
            "task_type": "TRIGGER",
            "interface": "TRIGGER",
            "manual_time_minutes": 0.0,
            "automation_time_minutes": 0.0,
            "machine_wait_time_minutes": 0.0,
            "occurrence": 1,
            "source_data_list": [],
            "output_data_list": [],
            "verification_steps": [],
            "blockers": [],
            "errors": [],
            "media": [],
            "reference_links": [],
            "instructions": [],
            "owner_positions": [],
            "target_systems": [],
        },
        {
            "workflow_id": 0,
            "node_id": "node-decision",
            "name": "Decision",
            "description": "Check threshold",
            "task_type": "DECISION",
            "manual_time_minutes": 3.0,
            "automation_time_minutes": 0.0,
            "machine_wait_time_minutes": 0.0,
            "occurrence": 1,
            "source_data_list": [],
            "output_data_list": [],
            "verification_steps": [],
            "blockers": [],
            "errors": [],
            "media": [],
            "reference_links": [],
            "instructions": [],
            "owner_positions": [],
            "target_systems": [],
        },
        {
            "workflow_id": 0,
            "node_id": "node-a",
            "name": "Path A",
            "description": "Go this way",
            "task_type": "System Interaction",
            "manual_time_minutes": 4.0,
            "automation_time_minutes": 0.0,
            "machine_wait_time_minutes": 0.0,
            "occurrence": 1,
            "source_data_list": [],
            "output_data_list": [],
            "verification_steps": [],
            "blockers": [],
            "errors": [],
            "media": [],
            "reference_links": [],
            "instructions": [],
            "owner_positions": [],
            "target_systems": [],
        },
        {
            "workflow_id": 0,
            "node_id": "node-outcome",
            "name": "Outcome",
            "description": "Workflow complete",
            "task_type": "OUTCOME",
            "interface": "OUTCOME",
            "manual_time_minutes": 0.0,
            "automation_time_minutes": 0.0,
            "machine_wait_time_minutes": 0.0,
            "occurrence": 1,
            "source_data_list": [],
            "output_data_list": [],
            "verification_steps": [],
            "blockers": [],
            "errors": [],
            "media": [],
            "reference_links": [],
            "instructions": [],
            "owner_positions": [],
            "target_systems": [],
        },
    ]
    invalid_payload["edges"] = [
        {"source": "node-trigger", "target": "node-decision", "label": ""},
        {"source": "node-decision", "target": "node-a", "label": "Maybe"},
        {"source": "node-a", "target": "node-outcome", "label": ""},
    ]

    update_response = await api_client.put(f"/api/workflows/{workflow_id}", json=invalid_payload)
    assert update_response.status_code == 400
    assert "Decision logic is malformed" in update_response.text


@pytest.mark.asyncio
async def test_workflow_templates_insights_and_discovery(api_client: AsyncClient):
    created_ids = []
    for name, prc, wf_type, team in [
        ("Overlay Review A", "PRC-OL", "Verification", "Metrology"),
        ("Overlay Review B", "PRC-OL", "Verification", "Yield"),
        ("Shift Handoff", "PRC-SH", "Shift Handoff", "Metrology"),
    ]:
        payload = workflow_payload()
        payload["name"] = name
        payload["prc"] = prc
        payload["workflow_type"] = wf_type
        payload["team"] = team
        response = await api_client.post("/api/workflows", json=payload)
        assert response.status_code == 200, response.text
        created_ids.append(response.json()["id"])

    templates_response = await api_client.get("/api/workflows/templates")
    assert templates_response.status_code == 200, templates_response.text
    assert len(templates_response.json()) >= 2

    insights_response = await api_client.get("/api/workflows/insights/overview")
    assert insights_response.status_code == 200, insights_response.text
    insights = insights_response.json()
    assert insights["workflow_count"] >= 3
    assert insights["top_contributors"]
    assert insights["team_participation"]

    discovery_response = await api_client.get(f"/api/workflows/discovery/{created_ids[0]}")
    assert discovery_response.status_code == 200, discovery_response.text
    discovery = discovery_response.json()
    assert discovery["related"]
    assert any(item["prc"] == "PRC-OL" for item in discovery["duplicates"])

    assist_response = await api_client.post(
        "/api/workflows/draft-assist",
        json={
            "name": "Overlay shift handoff",
            "description": "Review and hand off overlay state between shifts.",
            "quick_capture_notes": "Need validation, exception capture, and a handoff checklist.",
            "tool_family": ["Overlay"],
        },
    )
    assert assist_response.status_code == 200, assist_response.text
    assist = assist_response.json()
    assert assist["confidence"] >= 42
    assert assist["suggested_fields"]["workflow_type"] in {"Shift Handoff", "Verification"}
    assert assist["draft_outline"]
    assert "executive_summary" in assist


@pytest.mark.asyncio
async def test_president_insights_include_candidates_benefits_and_standards(api_client: AsyncClient):
    create_response = await api_client.post("/api/workflows", json=workflow_payload())
    assert create_response.status_code == 200, create_response.text
    workflow_id = create_response.json()["id"]

    payload = workflow_payload()
    payload["name"] = "President-Level Workflow"
    payload["governance"]["standards_flags"] = ["ownership", "roi", "automation-ready"]
    payload["tasks"] = workflow_tasks()
    payload["edges"] = [
        {"source": "node-trigger", "target": "node-task", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]
    update_response = await api_client.put(f"/api/workflows/{workflow_id}", json=payload)
    assert update_response.status_code == 200, update_response.text

    execution_response = await api_client.post(
        "/api/executions",
        json={
            "workflow_id": workflow_id,
            "executed_by": "Haewon Kim",
            "team": "Metrology",
            "site": "ATX",
            "actual_duration_minutes": 8.0,
            "baseline_manual_minutes": 15.0,
            "automated_duration_minutes": 4.0,
            "wait_duration_minutes": 2.0,
            "recovery_time_minutes": 1.0,
            "exception_count": 1,
            "automation_coverage_percent": 60.0,
            "blockers_encountered": ["Minor queue delay"],
            "notes": "Measured after workflow hardening.",
        },
    )
    assert execution_response.status_code == 200, execution_response.text
    assert execution_response.json()["workflow_version"] == 1

    project_response = await api_client.post(
        "/api/projects",
        json={
            "name": "President-Level Automation",
            "workflow_ids": [workflow_id],
            "owner": "Automation Team",
            "priority": "High",
            "status": "Deployed",
            "health": "On Track",
            "progress_percent": 100.0,
            "projected_hours_saved_weekly": 4.5,
            "realized_hours_saved_weekly": 3.0,
            "traceability": {"source_workflow_id": workflow_id, "validation_plan": "Compare before and after runs"},
            "benefits_realization": {"realization_note": "Realized savings now measurable"},
            "exception_governance": {"top_exception_nodes": ["node-task"]},
            "delivery_metrics": {"readiness": 82.0},
            "blocker_summary": [],
            "milestone_summary": [],
        },
    )
    assert project_response.status_code == 200, project_response.text

    standards_response = await api_client.get("/api/workflows/standards/library")
    assert standards_response.status_code == 200, standards_response.text
    assert any(item["flag"] == "roi" for item in standards_response.json())

    insights_response = await api_client.get("/api/workflows/insights/president")
    assert insights_response.status_code == 200, insights_response.text
    insights = insights_response.json()
    assert insights["automation_candidate_queue"]
    assert insights["benefits_realization"]["projected_hours_weekly"] >= 0
    assert insights["benefits_realization"]["realized_hours_weekly"] >= 0
    assert insights["traceability_rows"]
    assert insights["executive_narratives"]
    assert insights["workflow_operations_center"]["review_queue"] is not None
    assert insights["contributor_scorecards"] is not None
    assert insights["shareable_report"]["title"] == "PathOS Executive Rollout Brief"


@pytest.mark.asyncio
async def test_workflow_update_conflict_returns_latest_workflow_snapshot(api_client: AsyncClient):
    create_response = await api_client.post("/api/workflows", json=workflow_payload())
    assert create_response.status_code == 200, create_response.text
    created = create_response.json()
    workflow_id = created["id"]

    first_payload = workflow_payload()
    first_payload["name"] = "Conflict Baseline"
    first_payload["tasks"] = workflow_tasks()
    first_payload["edges"] = [
        {"source": "node-trigger", "target": "node-task", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]

    first_update = await api_client.put(f"/api/workflows/{workflow_id}", json=first_payload)
    assert first_update.status_code == 200, first_update.text
    latest = first_update.json()

    stale_payload = workflow_payload()
    stale_payload["name"] = "Stale Save Attempt"
    stale_payload["expected_updated_at"] = created["updated_at"]
    stale_payload["tasks"] = workflow_tasks()
    stale_payload["edges"] = [
        {"source": "node-trigger", "target": "node-task", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]

    stale_response = await api_client.put(f"/api/workflows/{workflow_id}", json=stale_payload)
    assert stale_response.status_code == 409, stale_response.text
    body = stale_response.json()
    assert "Save conflict detected" in body["message"]
    assert body["current_workflow"]["name"] == latest["name"]
    assert body["current_updated_at"]


@pytest.mark.asyncio
async def test_policy_overlay_and_rollback_draft_endpoints_return_expected_structures(api_client: AsyncClient):
    create_response = await api_client.post("/api/workflows", json=workflow_payload())
    assert create_response.status_code == 200, create_response.text
    workflow_id = create_response.json()["id"]

    payload = workflow_payload()
    payload["name"] = "Versionable Workflow"
    payload["version_notes"] = "Base authoring pass"
    payload["tasks"] = workflow_tasks()
    payload["edges"] = [
        {"source": "node-trigger", "target": "node-task", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]
    updated_response = await api_client.put(f"/api/workflows/{workflow_id}", json=payload)
    assert updated_response.status_code == 200, updated_response.text

    version_response = await api_client.post(f"/api/workflows/{workflow_id}/clone", params={"mode": "version", "workspace": "Personal Drafts"})
    assert version_response.status_code == 200, version_response.text
    versioned = version_response.json()

    policy_response = await api_client.get(f"/api/workflows/policy-overlays/{versioned['id']}")
    assert policy_response.status_code == 200, policy_response.text
    policy = policy_response.json()
    assert "rules" in policy
    assert isinstance(policy["rules"], list)

    rollback_preview_response = await api_client.get(f"/api/workflows/{versioned['id']}/rollback-preview")
    assert rollback_preview_response.status_code == 200, rollback_preview_response.text
    rollback_preview = rollback_preview_response.json()
    assert rollback_preview["available"] is True
    assert rollback_preview["task_count"] == 3
    assert rollback_preview["edge_count"] == 2
    assert rollback_preview["target_version"] == 1

    rollback_draft_response = await api_client.post(
        f"/api/workflows/{versioned['id']}/rollback-draft",
        params={"workspace": "Personal Drafts"},
    )
    assert rollback_draft_response.status_code == 200, rollback_draft_response.text
    rollback_draft = rollback_draft_response.json()
    assert rollback_draft["workspace"] == "Personal Drafts"
    assert rollback_draft["tasks"][1]["name"] == "Measure Wafer"
    assert rollback_draft["edges"][0]["source"] == "node-trigger"
    assert any(entry["type"] == "workflow.rollback_draft" for entry in rollback_draft["activity_timeline"])


@pytest.mark.asyncio
async def test_company_rollout_overview_search_inbox_and_governance_actions(api_client: AsyncClient):
    overview_response = await api_client.get("/api/settings/admin-overview")
    assert overview_response.status_code == 200, overview_response.text
    overview = overview_response.json()
    assert overview["active_member"]["email"] == "haewon.kim@company.example"
    assert overview["members"]
    assert overview["configs"]

    member_email = overview["active_member"]["email"]
    saved_view_response = await api_client.post(
        "/api/settings/saved-views",
        json={
            "entity_type": "workflow",
            "name": "Review Queue",
            "owner_email": member_email,
            "scope": "shared",
            "search_text": "review verification",
            "filters": {"status": ["Workflow Review"]},
            "active_ribbon": "Collaborative Workflows",
            "view_mode": "active",
            "shared_with_roles": ["reviewer"],
            "shared_with_teams": ["Process Control"],
        },
    )
    assert saved_view_response.status_code == 200, saved_view_response.text

    create_response = await api_client.post("/api/workflows", json=workflow_payload())
    assert create_response.status_code == 200, create_response.text
    workflow_id = create_response.json()["id"]

    payload = workflow_payload()
    payload["name"] = "Governance Search Workflow"
    payload["workspace"] = "Collaborative Workflows"
    payload["team"] = "Process Control"
    payload["org"] = "Metrology"
    payload["tasks"] = workflow_tasks()
    payload["edges"] = [
        {"source": "node-trigger", "target": "node-task", "label": ""},
        {"source": "node-task", "target": "node-outcome", "label": ""},
    ]
    update_response = await api_client.put(f"/api/workflows/{workflow_id}", json=payload)
    assert update_response.status_code == 200, update_response.text

    search_response = await api_client.get("/api/workflows/global-search", params={"q": "governance search review"})
    assert search_response.status_code == 200, search_response.text
    search = search_response.json()
    assert search["workflows"]
    assert search["saved_views"]

    inbox_response = await api_client.get("/api/workflows/inbox", params={"member_email": member_email})
    assert inbox_response.status_code == 200, inbox_response.text
    inbox = inbox_response.json()
    assert inbox["member"]["email"] == member_email
    assert inbox["unread_count"] >= 1

    governance_center_response = await api_client.get("/api/workflows/governance-center")
    assert governance_center_response.status_code == 200, governance_center_response.text
    governance_center = governance_center_response.json()
    assert governance_center["counts"]["review"] >= 1
    assert governance_center["review_queue"]

    review_request_id = update_response.json()["review_requests"][0]["id"]
    governance_action_response = await api_client.post(
        f"/api/workflows/{workflow_id}/governance-action",
        json={"action": "approve_review", "actor": member_email, "request_id": review_request_id, "note": "Reviewed for company rollout"},
    )
    assert governance_action_response.status_code == 200, governance_action_response.text
    governed = governance_action_response.json()
    assert governed["review_state"] == "Approved"
    assert governed["review_requests"][0]["status"] == "approved"

    notification_id = governed["notification_feed"][0]["id"]
    read_response = await api_client.post(
        f"/api/workflows/{workflow_id}/notifications/{notification_id}/read",
        json={"actor": member_email},
    )
    assert read_response.status_code == 200, read_response.text
    updated = read_response.json()
    assert updated["notification_feed"][0]["read"] is True

    quality_response = await api_client.get("/api/settings/quality-overview")
    assert quality_response.status_code == 200, quality_response.text
    quality = quality_response.json()
    assert quality["portfolio"]["workflow_count"] >= 1
    assert "developer_commands" in quality


@pytest.mark.asyncio
async def test_runtime_config_and_rollout_synchronization(api_client: AsyncClient):
    # 1. Check baseline runtime-config
    config_response = await api_client.get("/api/settings/runtime-config")
    assert config_response.status_code == 200
    config = config_response.json()
    assert "organization" in config
    assert "org_options" in config["organization"]
    assert "project_governance" in config

    # 2. Update a rollout config via settings API
    current_rollout_res = await api_client.get("/api/settings/admin-overview")
    rollout_config = next(c for c in current_rollout_res.json()["configs"] if c["key"] == "company_rollout")
    
    updated_val = rollout_config["value"].copy()
    updated_val["organization_name"] = "PathOS Enterprise"
    updated_val["org_options"] = ["Ops", "Eng", "Test"]

    update_res = await api_client.put(
        f"/api/settings/app-config/company_rollout",
        json={"label": rollout_config["label"], "value": updated_val}
    )
    assert update_res.status_code == 200

    # 3. Verify runtime-config reflects the change
    new_config_res = await api_client.get("/api/settings/runtime-config")
    new_config = new_config_res.json()
    assert new_config["organization"]["name"] == "PathOS Enterprise"
    assert "Ops" in new_config["organization"]["org_options"]
