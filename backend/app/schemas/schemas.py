from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Any, Union
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

class TaskErrorCreate(TaskErrorBase):
    task_id: Optional[int] = None

class TaskErrorRead(TaskErrorBase):
    id: int
    task_id: int
    model_config = ConfigDict(from_attributes=True)

class TaskBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: str
    target_system: Optional[str] = None
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
    source_data_list: Optional[List[Any]] = []
    output_data_list: Optional[List[Any]] = []
    output_format_example: Optional[str] = None
    post_task_verification: Optional[str] = None
    verification_steps: Optional[List[Any]] = []
    
    validation_needed: bool = False
    validation_procedure: Optional[str] = None

    risks_yield_scrap: bool = False
    tribal_knowledge: Optional[Union[str, List[Any]]] = None
    tribal_knowledge_list: Optional[List[Any]] = []
    media: Optional[List[Any]] = None
    reference_links: Optional[List[Any]] = []
    order_index: int = 0

class TaskCreate(TaskBase):
    workflow_id: int
    blockers: Optional[List[BlockerCreate]] = []
    errors: Optional[List[TaskErrorCreate]] = []

class TaskRead(TaskBase):
    id: int
    workflow_id: int
    blockers: List[BlockerRead] = []
    errors: List[TaskErrorRead] = []
    model_config = ConfigDict(from_attributes=True)

class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=2)
    version: int = 1
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
    flow_summary: Optional[str] = None
    edges: Optional[List[Any]] = []

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowRead(WorkflowBase):
    id: int
    status: str
    total_roi_saved_hours: float
    tasks: List[TaskRead] = []
    created_at: datetime
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
    previous_state: Optional[dict] = None
    new_state: Optional[dict] = None
    description: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)
