from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Any, Union, Literal
from datetime import datetime

class TaxonomyBase(BaseModel):
    category: str
    label: str
    value: str
    description: Optional[str] = None
    is_default: bool = False

class TaxonomyRead(TaxonomyBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BlockerBase(BaseModel):
    blocking_entity: str
    reason: str
    probability_percent: float = 0.0
    average_delay_minutes: float = 0.0
    standard_mitigation: str

class BlockerCreate(BlockerBase):
    task_id: Optional[int] = None

class BlockerRead(BlockerBase):
    id: int
    task_id: int
    model_config = ConfigDict(from_attributes=True)

class TaskErrorBase(BaseModel):
    error_type: str
    description: str
    probability_percent: float = 0.0
    recovery_time_minutes: float = 0.0
    correction_method: Optional[str] = None

class TaskErrorCreate(TaskErrorBase):
    task_id: Optional[int] = None

class TaskErrorRead(TaskErrorBase):
    id: int
    task_id: int
    model_config = ConfigDict(from_attributes=True)

class DataItemSchema(BaseModel):
    id: Optional[str] = None
    name: str = ""
    description: str = ""
    figures: List[str] = []
    link: str = ""
    data_example: str = ""
    from_task_id: Optional[str] = None
    from_task_name: Optional[str] = None
    orphaned_input: bool = False
    orphaned_output: bool = False

class MediaAssetSchema(BaseModel):
    id: Optional[str] = None
    type: str = "image"
    url: str
    label: str = ""
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    uploaded_at: Optional[str] = None

class ReferenceLinkSchema(BaseModel):
    id: Optional[str] = None
    url: str = ""
    label: str = ""
    description: Optional[str] = None

class ValidationStepSchema(BaseModel):
    id: Optional[str] = None
    description: str = ""
    figures: List[str] = []

class InstructionSchema(BaseModel):
    id: Optional[str] = None
    description: str = ""
    figures: List[str] = []
    links: List[str] = []

class WorkflowCommentSchema(BaseModel):
    id: Optional[str] = None
    scope: Literal["workflow", "task", "section"] = "workflow"
    scope_id: Optional[str] = None
    author: str = "system_user"
    message: str
    mentions: List[str] = []
    parent_id: Optional[str] = None
    assignee: Optional[str] = None
    review_state: str = "open"
    created_at: Optional[str] = None
    resolved: bool = False

class AccessControlSchema(BaseModel):
    visibility: str = "private"
    viewers: List[str] = []
    editors: List[str] = []
    mention_groups: List[str] = []
    owner: str = "system_user"

class WorkflowOwnershipSchema(BaseModel):
    owner: str = "system_user"
    smes: List[str] = []
    backup_owners: List[str] = []
    automation_owner: Optional[str] = None
    reviewers: List[str] = []

class WorkflowGovernanceSchema(BaseModel):
    lifecycle_stage: str = "Draft"
    review_state: str = "Draft"
    approval_state: str = "Draft"
    required_reviewer_roles: List[str] = []
    standards_flags: List[str] = []
    stale_after_days: int = 90
    review_due_at: Optional[str] = None
    last_reviewed_at: Optional[str] = None

class ReviewRequestSchema(BaseModel):
    id: Optional[str] = None
    role: str
    requested_from: Optional[str] = None
    requested_by: str = "system_user"
    status: str = "open"
    due_at: Optional[str] = None
    note: Optional[str] = None

class ActivityEntrySchema(BaseModel):
    id: Optional[str] = None
    type: str
    message: str
    actor: str = "system_user"
    created_at: Optional[str] = None

class NotificationSchema(BaseModel):
    id: Optional[str] = None
    kind: str
    title: str
    detail: Optional[str] = None
    read: bool = False
    created_at: Optional[str] = None

class SimulationSummarySchema(BaseModel):
    best_case_minutes: float = 0.0
    worst_case_minutes: float = 0.0
    critical_path_minutes: float = 0.0
    critical_path_nodes: List[str] = []
    path_count: int = 0

class WorkflowAnalysisSchema(BaseModel):
    has_cycle: bool = False
    cycle_nodes: List[str] = []
    disconnected_nodes: List[str] = []
    unreachable_nodes: List[str] = []
    malformed_logic_nodes: List[str] = []
    orphaned_inputs: List[str] = []
    critical_path_minutes: float = 0.0
    critical_path_hours: float = 0.0
    critical_path_nodes: List[str] = []
    shift_handoff_risk: bool = False
    diff_summary: dict = {}
    diagnostics: dict = {}
    bottlenecks: List[dict] = []
    scores: dict = {}
    change_impact: dict = {}
    recommendations: List[dict] = []
    benchmarking: dict = {}
    certification: dict = {}
    storytelling: dict = {}
    portfolio_rollup: dict = {}
    opportunity_queue: List[dict] = []
    standards_library_matches: List[dict] = []
    task_diagnostic_summary: dict = {}


class WorkflowSummarySchema(BaseModel):
    id: int
    name: str
    status: str
    total_roi_saved_hours: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class WorkflowExecutionBase(BaseModel):
    workflow_id: int
    workflow_version: Optional[int] = None
    workflow_name_snapshot: Optional[str] = None
    automation_status_snapshot: Optional[str] = None
    execution_started_at: Optional[datetime] = None
    execution_completed_at: Optional[datetime] = None
    executed_by: Optional[str] = None
    team: Optional[str] = None
    site: Optional[str] = None
    status: str = "Completed"
    actual_duration_minutes: float = 0.0
    baseline_manual_minutes: float = 0.0
    automated_duration_minutes: float = 0.0
    wait_duration_minutes: float = 0.0
    recovery_time_minutes: float = 0.0
    exception_count: int = 0
    automation_coverage_percent: float = 0.0
    blockers_encountered: List[str] = []
    notes: Optional[str] = None


class WorkflowExecutionCreate(WorkflowExecutionBase):
    pass


class WorkflowExecutionRead(WorkflowExecutionBase):
    id: int
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    workflow: Optional[WorkflowSummarySchema] = None
    model_config = ConfigDict(from_attributes=True)


class AutomationProjectBase(BaseModel):
    name: str = Field(..., min_length=2)
    workflow_ids: List[int] = []
    summary: Optional[str] = None
    owner: Optional[str] = None
    sponsor: Optional[str] = None
    team: Optional[str] = None
    priority: str = "Medium"
    status: str = "Scoping"
    health: str = "On Track"
    progress_percent: float = 0.0
    target_completion_date: Optional[datetime] = None
    projected_hours_saved_weekly: float = 0.0
    realized_hours_saved_weekly: float = 0.0
    blocker_summary: List[str] = []
    milestone_summary: List[str] = []
    traceability: Optional[dict] = None
    benefits_realization: Optional[dict] = None
    exception_governance: Optional[dict] = None
    delivery_metrics: Optional[dict] = None
    next_action: Optional[str] = None
    last_update: Optional[str] = None


class AutomationProjectCreate(AutomationProjectBase):
    pass


class AutomationProjectRead(AutomationProjectBase):
    id: int
    is_deleted: bool = False
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TaskBase(BaseModel):
    name: str = Field(..., min_length=1)
    node_id: Optional[str] = None
    task_type: Optional[str] = None
    description: str
    target_system: Optional[str] = None
    target_systems: Optional[List[Any]] = []
    interface_type: Optional[str] = None
    interface: Optional[str] = None
    
    # Canvas Position
    position_x: Optional[float] = None
    position_y: Optional[float] = None

    # Locked Operational Parameters
    tool_id: Optional[str] = None
    hardware_family: Optional[str] = None
    trigger_architecture: Optional[str] = None
    output_classification: Optional[str] = None
    
    active_touch_time_minutes: float = 0.0
    machine_wait_time_minutes: float = 0.0
    automation_time_minutes: float = 0.0
    manual_time_minutes: float = 0.0
    occurrence: int = 1
    occurrence_explanation: Optional[str] = None
    
    # Ownership
    owning_team: Optional[str] = None
    owner_positions: Optional[List[str]] = []
    
    shadow_it_used: bool = False
    shadow_it_link: Optional[str] = None
    source_data: Optional[str] = None
    source_data_list: Optional[List[DataItemSchema]] = []
    output_data_list: Optional[List[DataItemSchema]] = []
    output_format_example: Optional[str] = None
    post_task_verification: Optional[str] = None
    verification_steps: Optional[List[ValidationStepSchema]] = []
    
    validation_needed: bool = False
    validation_procedure: Optional[str] = None

    risks_yield_scrap: bool = False
    tribal_knowledge: Optional[Union[str, List[str]]] = None
    tribal_knowledge_list: Optional[List[Any]] = []
    media: Optional[List[MediaAssetSchema]] = None
    reference_links: Optional[List[ReferenceLinkSchema]] = []
    instructions: Optional[List[InstructionSchema]] = []
    diagnostics: Optional[dict] = None
    phase_name: Optional[str] = None
    subflow_name: Optional[str] = None
    task_block_key: Optional[str] = None
    decision_details: Optional[dict] = None
    order_index: int = 0

class TaskCreate(TaskBase):
    workflow_id: int
    blockers: Optional[List[BlockerCreate]] = []
    errors: Optional[List[TaskErrorCreate]] = []

class TaskRead(TaskBase):
    id: int
    workflow_id: int
    is_deleted: bool = False
    blockers: List[BlockerRead] = []
    errors: List[TaskErrorRead] = []
    model_config = ConfigDict(from_attributes=True)

class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=2)
    version: int = 1
    workspace: str = "Submitted Requests"
    parent_workflow_id: Optional[int] = None
    version_group: Optional[str] = None
    version_notes: Optional[str] = None
    version_base_snapshot: Optional[dict] = None
    prc: Optional[str] = None
    workflow_type: Optional[str] = None
    tool_family: Optional[str] = None
    tool_family_count: int = 1
    tool_id: Optional[str] = None
    org: Optional[str] = None
    team: Optional[str] = None
    poc: Optional[str] = None
    description: Optional[str] = None
    trigger_type: str
    trigger_description: str
    cadence_count: float = 1.0
    cadence_unit: str = "week" # day, week, month, year
    output_type: str
    output_description: str
    repeatability_check: bool = True
    equipment_required: bool = False
    equipment_state: Optional[str] = None
    cleanroom_required: bool = False
    flow_summary: Optional[str] = None
    edges: Optional[List[Any]] = []
    access_control: Optional[AccessControlSchema] = None
    comments: Optional[List[WorkflowCommentSchema]] = []
    analysis: Optional[WorkflowAnalysisSchema] = None
    simulation: Optional[SimulationSummarySchema] = None
    quick_capture_notes: Optional[str] = None
    template_key: Optional[str] = None
    ownership: Optional[WorkflowOwnershipSchema] = None
    governance: Optional[WorkflowGovernanceSchema] = None
    review_state: str = "Draft"
    approval_state: str = "Draft"
    required_reviewer_roles: Optional[List[str]] = []
    review_requests: Optional[List[ReviewRequestSchema]] = []
    activity_timeline: Optional[List[ActivityEntrySchema]] = []
    notification_feed: Optional[List[NotificationSchema]] = []
    related_workflow_ids: Optional[List[int]] = []
    standards_profile: Optional[dict] = None

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowRead(WorkflowBase):
    id: int
    is_deleted: bool = False
    status: str
    total_roi_saved_hours: float
    tasks: List[TaskRead] = []
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str
    model_config = ConfigDict(from_attributes=True)

class SystemParameterBase(BaseModel):
    label: str
    description: Optional[str] = None
    is_dynamic: bool = False
    manual_values: Optional[List[str]] = []
    python_code: Optional[str] = None

class SystemParameterUpdate(SystemParameterBase):
    pass

class SystemParameterRead(SystemParameterBase):
    key: str
    last_executed: Optional[datetime] = None
    cached_values: Optional[List[Any]] = None
    pending_values: Optional[List[Any]] = None
    has_discrepancy: bool = False
    model_config = ConfigDict(from_attributes=True)

class ParameterLogRead(BaseModel):
    id: int
    parameter_key: str
    timestamp: datetime
    status: str
    message: Optional[str] = None
    found_values: Optional[List[Any]] = None
    execution_time: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class AuditLogRead(BaseModel):
    id: int
    timestamp: datetime
    user_id: str
    action_type: str
    table_name: str
    record_id: int


class AppConfigBase(BaseModel):
    label: str
    description: Optional[str] = None
    value: Optional[dict] = None


class AppConfigUpdate(AppConfigBase):
    pass


class AppConfigRead(AppConfigBase):
    key: str
    model_config = ConfigDict(from_attributes=True)


class OrgMemberBase(BaseModel):
    full_name: str
    email: str
    title: Optional[str] = None
    org: Optional[str] = None
    team: Optional[str] = None
    site: Optional[str] = None
    manager: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    status: str = "active"
    avatar_initials: Optional[str] = None


class OrgMemberCreate(OrgMemberBase):
    pass


class OrgMemberRead(OrgMemberBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class SavedViewBase(BaseModel):
    entity_type: str = "workflow"
    name: str
    owner_email: str
    scope: str = "personal"
    search_text: Optional[str] = None
    filters: Optional[dict] = None
    active_ribbon: Optional[str] = None
    view_mode: Optional[str] = None
    shared_with_roles: List[str] = []
    shared_with_teams: List[str] = []


class SavedViewCreate(SavedViewBase):
    pass


class SavedViewRead(SavedViewBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class RuntimeConfigRead(BaseModel):
    profile: dict
    app: dict
    network: dict
    organization: dict
    governance: dict
    project_governance: dict = {}
    workflow_defaults: dict
    roles: List[dict] = []
    parameters: dict = {}
    templates: List[dict] = []
    integrations: dict = {}
    features: dict = {}
    current_member: Optional[dict] = None


class RuntimeConfigImport(BaseModel):
    app_configs: List[AppConfigRead] = []
    members: List[OrgMemberCreate] = []
    saved_views: List[SavedViewCreate] = []
    previous_state: Optional[dict] = None
    new_state: Optional[dict] = None
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class EnvironmentConfigRead(BaseModel):
    backend_env: str
    frontend_env: str
    backend_path: str
    frontend_path: str


class EnvironmentConfigUpdate(BaseModel):
    backend_env: Optional[str] = None
    frontend_env: Optional[str] = None
