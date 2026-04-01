from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
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

class TaskBase(BaseModel):
    name: str = Field(..., min_length=1)
    description: str
    target_system: str
    tat_minutes: float = 0.0
    occurrences_per_cycle: int = 1
    potential_mistakes: Optional[str] = None
    error_probability: float = 0.0
    recovery_time_minutes: float = 0.0
    order_index: int = 0

class TaskCreate(TaskBase):
    workflow_id: int

class TaskRead(TaskBase):
    id: int
    workflow_id: int
    model_config = ConfigDict(from_attributes=True)

class WorkflowBase(BaseModel):
    name: str = Field(..., min_length=2)
    trigger_type: str
    trigger_description: str
    frequency: float
    output_type: str
    output_description: str
    repeatability_check: bool = True

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowRead(WorkflowBase):
    id: int
    status: str
    total_roi_saved_hours: float
    tasks: List[TaskRead] = []
    created_at: datetime
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
