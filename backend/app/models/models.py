from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, JSON, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base

class BaseMixin:
    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_deleted = Column(Boolean, default=False)
    created_by = Column(String, default="system_user")
    updated_by = Column(String, default="system_user")

class AutomationStatus(str, enum.Enum):
    CREATED = "Created"
    WORKFLOW_REVIEW = "Workflow Review"
    PRIORITY_MEASUREMENT = "Priority Measurement"
    FEASIBILITY_REVIEW = "Feasibility Review"
    BACKLOG = "Backlog"
    AUTOMATION_BRAINSTORMING = "Automation Brainstorming"
    AUTOMATION_PLANNED = "Automation Planned"
    IN_AUTOMATION = "In Automation"
    VERIFICATION = "Verification"
    PARTIALLY_AUTOMATED = "Partially Automated"
    FULLY_AUTOMATED = "Fully Automated"

class Workflow(Base, BaseMixin):
    __tablename__ = "workflows"
    name = Column(String, index=True)
    version = Column(Integer, default=1)
    workspace = Column(String, default="Submitted Requests")
    parent_workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=True)
    version_group = Column(String, nullable=True)
    version_notes = Column(Text, nullable=True)
    version_base_snapshot = Column(JSON, nullable=True)
    prc = Column(String, nullable=True) # New Field
    workflow_type = Column(String, nullable=True) # New Field (e.g. SPC, FDC, OOC)
    tool_family = Column(String, nullable=True) # e.g. [CD-SEM], [Overlay]
    tool_family_count = Column(Integer, default=1) # New Field for 'Family + Count'
    tool_id = Column(String, nullable=True) # Specific tool IDs
    
    # Organization & POCs
    org = Column(String, nullable=True)
    team = Column(String, nullable=True)
    poc = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    # Intake / Gatekeeper Fields
    trigger_type = Column(String) 
    trigger_description = Column(Text)
    
    # Operational Cadence (v2: Count + Unit)
    cadence_count = Column(Float, default=1.0)
    cadence_unit = Column(String, default="week") # day, week, month, year
    
    output_type = Column(String) 
    output_description = Column(Text)
    repeatability_check = Column(Boolean, default=True)
    equipment_required = Column(Boolean, default=False)
    equipment_state = Column(String, nullable=True)
    cleanroom_required = Column(Boolean, default=False)
    
    # Metadata & Health
    status = Column(String, default=AutomationStatus.CREATED.value)
    flow_summary = Column(Text, nullable=True) # Trigger -> Output preview
    edges = Column(JSON, nullable=True) # Graph edges
    access_control = Column(JSON, nullable=True)
    comments = Column(JSON, nullable=True)
    analysis = Column(JSON, nullable=True)
    simulation = Column(JSON, nullable=True)
    quick_capture_notes = Column(Text, nullable=True)
    template_key = Column(String, nullable=True)
    ownership = Column(JSON, nullable=True)
    governance = Column(JSON, nullable=True)
    review_state = Column(String, default="Draft")
    approval_state = Column(String, default="Draft")
    required_reviewer_roles = Column(JSON, nullable=True)
    review_requests = Column(JSON, nullable=True)
    activity_timeline = Column(JSON, nullable=True)
    notification_feed = Column(JSON, nullable=True)
    related_workflow_ids = Column(JSON, nullable=True)
    standards_profile = Column(JSON, nullable=True)
    
    # ROI Metrics (Cached/Calculated)
    total_roi_saved_hours = Column(Float, default=0.0)
    
    tasks = relationship("Task", back_populates="workflow", cascade="all, delete-orphan", order_by="Task.order_index")
    executions = relationship("WorkflowExecution", back_populates="workflow", cascade="all, delete-orphan")

class Task(Base, BaseMixin):
    __tablename__ = "tasks"
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    node_id = Column(String, index=True, nullable=True) # Stable ID from Frontend (e.g. node-123)
    name = Column(String)
    task_type = Column(String, nullable=True) # e.g. Documentation, Inspection, Measurement
    description = Column(Text)
    target_system = Column(String, nullable=True) # Legacy singular field
    target_systems = Column(JSON, nullable=True) # New plural list of objects
    interface_type = Column(String, nullable=True) # GUI, API, DB, File, DECISION, TRIGGER, OUTCOME
    interface = Column(String, nullable=True) # TRIGGER, OUTCOME
    
    # Canvas Position
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    
    # Locked Operational Parameters
    tool_id = Column(String, nullable=True)
    hardware_family = Column(String, nullable=True)
    trigger_architecture = Column(String, nullable=True)
    output_classification = Column(String, nullable=True)
    
    # Time & Effort
    active_touch_time_minutes = Column(Float, default=0.0)
    machine_wait_time_minutes = Column(Float, default=0.0)
    automation_time_minutes = Column(Float, default=0.0) # Added to match frontend
    manual_time_minutes = Column(Float, default=0.0) # Added to match frontend
    occurrence = Column(Integer, default=1)
    occurrence_explanation = Column(Text, nullable=True)
    
    # Ownership
    owning_team = Column(String, nullable=True)
    owner_positions = Column(JSON, nullable=True) # List of strings
    
    # Automation & IT
    shadow_it_used = Column(Boolean, default=False)
    shadow_it_link = Column(String, nullable=True)
    
    # Data Lineage
    source_data = Column(Text, nullable=True)
    source_data_list = Column(JSON, nullable=True)
    output_data_list = Column(JSON, nullable=True)
    output_format_example = Column(Text, nullable=True)
    post_task_verification = Column(Text, nullable=True)
    verification_steps = Column(JSON, nullable=True)
    
    # Validation
    validation_needed = Column(Boolean, default=False)
    validation_procedure = Column(Text, nullable=True)
    
    # Corner Cases & Risks
    risks_yield_scrap = Column(Boolean, default=False)
    tribal_knowledge = Column(JSON, nullable=True)
    tribal_knowledge_list = Column(JSON, nullable=True)
    media = Column(JSON, nullable=True) # List of image/file references
    reference_links = Column(JSON, nullable=True)
    instructions = Column(JSON, nullable=True) # New Field: List of objects {step, description, image, links}
    diagnostics = Column(JSON, nullable=True)
    phase_name = Column(String, nullable=True)
    subflow_name = Column(String, nullable=True)
    task_block_key = Column(String, nullable=True)
    decision_details = Column(JSON, nullable=True)
    
    order_index = Column(Integer, default=0)
    
    workflow = relationship("Workflow", back_populates="tasks")
    blockers = relationship("Blocker", back_populates="task", cascade="all, delete-orphan")
    errors = relationship("TaskError", back_populates="task", cascade="all, delete-orphan")

class TaskError(Base, BaseMixin):
    __tablename__ = "task_errors"
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    error_type = Column(String)
    description = Column(Text)
    probability_percent = Column(Float, default=0.0)
    recovery_time_minutes = Column(Float, default=0.0)
    correction_method = Column(Text, nullable=True)
    
    task = relationship("Task", back_populates="errors")

class Blocker(Base, BaseMixin):
    __tablename__ = "blockers"
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    blocking_entity = Column(String) 
    reason = Column(Text)
    probability_percent = Column(Float, default=0.0)
    average_delay_minutes = Column(Float, default=0.0)
    standard_mitigation = Column(Text)
    
    task = relationship("Task", back_populates="blockers")

class TaxonomyEnum(Base, BaseMixin):
    __tablename__ = "taxonomy_enums"
    category = Column(String, index=True) 
    label = Column(String, index=True)
    value = Column(String, unique=True)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)

class SystemParameter(Base, BaseMixin):
    __tablename__ = "system_parameters"
    key = Column(String, unique=True, index=True) # TOOL_ID, HARDWARE_FAMILY, TRIGGER_ARCHITECTURE, OUTPUT_CLASSIFICATION
    label = Column(String)
    description = Column(Text, nullable=True)
    is_dynamic = Column(Boolean, default=False)
    manual_values = Column(JSON, nullable=True)
    python_code = Column(Text, nullable=True)
    last_executed = Column(DateTime(timezone=True), nullable=True)
    cached_values = Column(JSON, nullable=True) # Confirmed/Current values
    pending_values = Column(JSON, nullable=True) # Found in last run but not confirmed
    has_discrepancy = Column(Boolean, default=False)

class ParameterLog(Base):
    __tablename__ = "parameter_logs"
    id = Column(Integer, primary_key=True)
    parameter_key = Column(String, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String) # SUCCESS, FAILED, DISCREPANCY
    message = Column(Text, nullable=True)
    found_values = Column(JSON, nullable=True)
    execution_time = Column(Float, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(String)
    action_type = Column(String) # CREATE, UPDATE, DELETE
    table_name = Column(String)
    record_id = Column(Integer)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    description = Column(Text, nullable=True)


class AppConfig(Base, BaseMixin):
    __tablename__ = "app_configs"
    key = Column(String, unique=True, index=True)
    label = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    value = Column(JSON, nullable=True)


class OrgMember(Base, BaseMixin):
    __tablename__ = "org_members"
    full_name = Column(String, nullable=False, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=True)
    org = Column(String, nullable=True, index=True)
    team = Column(String, nullable=True, index=True)
    site = Column(String, nullable=True, index=True)
    manager = Column(String, nullable=True)
    roles = Column(JSON, nullable=True)
    permissions = Column(JSON, nullable=True)
    status = Column(String, default="active")
    avatar_initials = Column(String, nullable=True)


class SavedView(Base, BaseMixin):
    __tablename__ = "saved_views"
    entity_type = Column(String, default="workflow", index=True)
    name = Column(String, nullable=False)
    owner_email = Column(String, nullable=False, index=True)
    scope = Column(String, default="personal")
    search_text = Column(String, nullable=True)
    filters = Column(JSON, nullable=True)
    active_ribbon = Column(String, nullable=True)
    view_mode = Column(String, nullable=True)
    shared_with_roles = Column(JSON, nullable=True)
    shared_with_teams = Column(JSON, nullable=True)


class WorkflowExecution(Base, BaseMixin):
    __tablename__ = "workflow_executions"
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_version = Column(Integer, nullable=True)
    workflow_name_snapshot = Column(String, nullable=True)
    automation_status_snapshot = Column(String, nullable=True)
    execution_started_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    execution_completed_at = Column(DateTime(timezone=True), nullable=True)
    executed_by = Column(String, nullable=True)
    team = Column(String, nullable=True)
    site = Column(String, nullable=True)
    status = Column(String, default="Completed")
    actual_duration_minutes = Column(Float, default=0.0)
    baseline_manual_minutes = Column(Float, default=0.0)
    automated_duration_minutes = Column(Float, default=0.0)
    wait_duration_minutes = Column(Float, default=0.0)
    recovery_time_minutes = Column(Float, default=0.0)
    exception_count = Column(Integer, default=0)
    automation_coverage_percent = Column(Float, default=0.0)
    blockers_encountered = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)

    workflow = relationship("Workflow", back_populates="executions")


class AutomationProject(Base, BaseMixin):
    __tablename__ = "automation_projects"
    name = Column(String, index=True, nullable=False)
    workflow_ids = Column(JSON, nullable=True)
    summary = Column(Text, nullable=True)
    owner = Column(String, nullable=True)
    sponsor = Column(String, nullable=True)
    team = Column(String, nullable=True)
    priority = Column(String, default="Medium")
    status = Column(String, default="Scoping")
    health = Column(String, default="On Track")
    progress_percent = Column(Float, default=0.0)
    target_completion_date = Column(DateTime(timezone=True), nullable=True)
    projected_hours_saved_weekly = Column(Float, default=0.0)
    realized_hours_saved_weekly = Column(Float, default=0.0)
    blocker_summary = Column(JSON, nullable=True)
    milestone_summary = Column(JSON, nullable=True)
    traceability = Column(JSON, nullable=True)
    benefits_realization = Column(JSON, nullable=True)
    exception_governance = Column(JSON, nullable=True)
    delivery_metrics = Column(JSON, nullable=True)
    next_action = Column(Text, nullable=True)
    last_update = Column(Text, nullable=True)
