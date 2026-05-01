from copy import deepcopy
from typing import Any

from .config import ROOT_DIR, config_value, get_profile_config


def get_fixed_parameters() -> list[str]:
    return list(config_value("parameters", "fixed", default=[]))


def get_parameter_keys() -> dict[str, str]:
    return dict(config_value("parameters", "keys", default={}))


def get_parameter_seed_defaults() -> list[dict[str, Any]]:
    return deepcopy(config_value("parameters", "defaults", default=[]))


def get_rollout_default_configs() -> dict[str, dict[str, Any]]:
    role_catalog = deepcopy(config_value("roles", "catalog", default=[]))
    governance = deepcopy(config_value("governance", default={}))
    organization = deepcopy(config_value("organization", default={}))
    notifications = deepcopy(config_value("notifications", default={}))
    return {
        "company_rollout": {
            "label": "Company Rollout Profile",
            "description": "Global rollout identity, auth, and workspace defaults.",
            "value": {
                "organization_name": organization.get("name", "PathOS Workspace"),
                "auth_mode": organization.get("auth_mode", "Local"),
                "active_member_email": organization.get("active_member_email"),
                "default_workspace": organization.get("default_workspace", "Collaborative Workflows"),
                "default_visibility": organization.get("default_visibility", "workspace"),
                "approval_sla_days": governance.get("approval_sla_days", 5),
                "recertification_default_days": governance.get("recertification_default_days", 90),
                "site_options": organization.get("site_options", []),
                "team_options": organization.get("team_options", []),
                "org_options": organization.get("org_options", []),
            },
        },
        "role_catalog": {
            "label": "Role Catalog",
            "description": "Supported company roles and their core responsibilities.",
            "value": {"roles": role_catalog},
        },
        "governance_policy": {
            "label": "Governance Policy",
            "description": "Certification and workflow-class governance standards.",
            "value": {
                "required_roles_by_workflow_type": governance.get("required_roles_by_workflow_type", {}),
                "certification_states": governance.get("certification_states", []),
                "stale_after_days": governance.get("stale_after_days", 90),
                "review_states": governance.get("review_states", []),
                "approval_states": governance.get("approval_states", []),
                "lifecycle_stages": governance.get("lifecycle_stages", []),
                "status_categories": governance.get("status_categories", {}),
            },
        },
        "notification_policy": {
            "label": "Notification Policy",
            "description": "Inbox and reminder defaults.",
            "value": {
                "channels": notifications.get("channels", ["in_app"]),
                "review_reminder_days": notifications.get("review_reminder_days", [2, 5]),
                "stale_workflow_digest_days": notifications.get("stale_workflow_digest_days", 7),
            },
        },
        "project_governance": {
            "label": "Project Governance",
            "description": "Automation project lifecycle, priorities, and health states.",
            "value": deepcopy(config_value("project_governance", default={})),
        },
    }


def get_default_org_members() -> list[dict[str, Any]]:
    return deepcopy(config_value("organization", "directory_seed", default=[]))


def get_default_identity_source() -> dict[str, Any]:
    return {
        "name": "Local Python Roster Source",
        "provider": "python_script",
        "working_dir": str(ROOT_DIR),
        "venv_path": str(config_value("organization", "identity_venv_path", default=".venv")),
        "script_path": "",
        "script_content": """import pandas as pd\n\n# Return a dataframe with one row per user.\n# Required columns: employee_id, full_name, email, title, org, team, site, manager, roles, permissions, status.\n# The backend will version the resulting roster and materialize the current active users.\n\ndef build_user_table():\n    return pd.DataFrame([\n        {\n            "employee_id": "USER-001",\n            "full_name": "System User",\n            "email": "system_user@example.com",\n            "title": "System User",\n            "org": "PathOS",\n            "team": "Platform",\n            "site": "Local",\n            "manager": "",\n            "roles": ["admin"],\n            "permissions": ["workflow.write", "workflow.approve"],\n            "status": "active",\n        }\n    ])\n\n\ndf = build_user_table()\n""",
        "schedule": "daily",
        "schema_version": "1",
        "is_active": True,
    }


def get_workflow_templates() -> list[dict[str, Any]]:
    return deepcopy(config_value("templates", "workflow", default=[]))


def get_keyword_hints() -> dict[str, dict[str, str]]:
    return {
        "shift": {"workflow_type": "Shift Handoff", "trigger_type": "Schedule", "output_type": "Report"},
        "handoff": {"workflow_type": "Shift Handoff", "trigger_type": "Schedule", "output_type": "Checklist"},
        "verify": {"workflow_type": "Verification", "trigger_type": "Schedule", "output_type": "Report"},
        "review": {"workflow_type": "Verification", "trigger_type": "Schedule", "output_type": "Approval"},
        "alarm": {"workflow_type": "Exception Response", "trigger_type": "Alarm", "output_type": "Resolution"},
        "exception": {"workflow_type": "Exception Response", "trigger_type": "Alarm", "output_type": "Resolution"},
        "automation": {"workflow_type": "Automation Study", "trigger_type": "Request", "output_type": "Recommendation"},
        "request": {"workflow_type": "Automation Study", "trigger_type": "Request", "output_type": "Recommendation"},
        "tool": {"trigger_type": "Tool State", "output_type": "Record"},
        "report": {"output_type": "Report"},
    }


def build_frontend_runtime_config(active_member: dict[str, Any] | None, members: list[dict[str, Any]], app_configs: dict[str, Any]) -> dict[str, Any]:
    config = get_profile_config()
    organization = config.get("organization", {})
    workflow_defaults = deepcopy(config.get("workflow_defaults", {}))
    governance = deepcopy(config.get("governance", {}))
    parameter_keys = deepcopy(config.get("parameters", {}).get("keys", {}))
    runtime_rollout = (app_configs.get("company_rollout") or {}).get("value") or {}
    runtime_governance = (app_configs.get("governance_policy") or {}).get("value") or {}
    runtime_roles = (app_configs.get("role_catalog") or {}).get("value") or {}
    runtime_projects = (app_configs.get("project_governance") or {}).get("value") or {}
    directory_names = [member.get("full_name") for member in members if member.get("full_name")]
    if not directory_names:
        directory_names = list(organization.get("mention_directory", []))
    mention_groups = sorted({member.get("team") for member in members if member.get("team")}) or list(organization.get("mention_groups", []))
    reviewer_role_options = [role.get("label") for role in runtime_roles.get("roles", []) if role.get("label")] or list(organization.get("reviewer_role_options", []))
    active_member_name = (active_member or {}).get("full_name") or workflow_defaults.get("ownership", {}).get("owner", "system_user")
    workflow_defaults.setdefault("access_control", {})
    workflow_defaults.setdefault("ownership", {})
    workflow_defaults.setdefault("governance", {})
    workflow_defaults["access_control"]["owner"] = active_member_name
    workflow_defaults["access_control"]["visibility"] = runtime_rollout.get("default_visibility", workflow_defaults["access_control"].get("visibility", "private"))
    workflow_defaults["ownership"]["owner"] = active_member_name
    workflow_defaults["governance"]["stale_after_days"] = runtime_governance.get("stale_after_days", workflow_defaults["governance"].get("stale_after_days", 90))
    res = {
        "profile": {
            "name": config.get("_meta", {}).get("selected_profile", "base"),
            "version": config.get("profile_version", 1),
            "warnings": config.get("_meta", {}).get("warnings", []),
        },
        "app": config.get("app", {}),
        "network": {
            "api_prefix": config.get("network", {}).get("backend", {}).get("api_prefix", "/api"),
            "uploads_base_url": "/uploads",
        },
        "organization": {
            "name": runtime_rollout.get("organization_name", organization.get("name")),
            "auth_mode": runtime_rollout.get("auth_mode", organization.get("auth_mode")),
            "default_workspace": runtime_rollout.get("default_workspace", organization.get("default_workspace")),
            "default_visibility": runtime_rollout.get("default_visibility", organization.get("default_visibility")),
            "workspace_options": organization.get("workspace_options", []),
            "lifecycle_options": organization.get("lifecycle_options", []),
            "mention_directory": directory_names,
            "mention_groups": mention_groups,
            "reviewer_role_options": reviewer_role_options,
            "site_options": runtime_rollout.get("site_options", organization.get("site_options", [])),
            "team_options": runtime_rollout.get("team_options", organization.get("team_options", [])),
            "org_options": runtime_rollout.get("org_options", organization.get("org_options", [])),
        },
        "governance": {
            "certification_states": runtime_governance.get("certification_states", governance.get("certification_states", [])),
            "review_states": runtime_governance.get("review_states", governance.get("review_states", [])),
            "approval_states": runtime_governance.get("approval_states", governance.get("approval_states", [])),
            "lifecycle_stages": runtime_governance.get("lifecycle_stages", governance.get("lifecycle_stages", [])),
            "status_categories": runtime_governance.get("status_categories", governance.get("status_categories", {})),
            "required_roles_by_workflow_type": runtime_governance.get("required_roles_by_workflow_type", governance.get("required_roles_by_workflow_type", {})),
        },
        "project_governance": runtime_projects or config.get("project_governance", {}),
        "workflow_defaults": workflow_defaults,
        "roles": runtime_roles.get("roles", []),
        "parameters": {
            "keys": parameter_keys,
            "defaults": get_parameter_seed_defaults(),
        },
        "templates": get_workflow_templates(),
        "integrations": config.get("integrations", {}),
        "features": config.get("features", {}),
        "current_member": active_member,
    }
    return res
