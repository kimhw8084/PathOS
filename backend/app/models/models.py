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

class TaxonomyCategory(str, enum.Enum):
    TRIGGER_TYPE = "TriggerType"
    TOOL_TYPE = "ToolType"
    WORKFLOW_TYPE = "WorkflowType"
    OUTPUT_TYPE = "OutputType"
    BLOCKING_ENTITY = "BlockingEntity"

class TaxonomyEnum(Base, BaseMixin):
    __tablename__ = "taxonomy_enums"
    category = Column(String, index=True) # Using string instead of Enum for flexibility
    label = Column(String, index=True)
    value = Column(String, unique=True)
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False)

class Workflow(Base, BaseMixin):
    __tablename__ = "workflows"
    name = Column(String, index=True)
    
    # Intake Fields
    trigger_type = Column(String) # Enum reference
    trigger_description = Column(Text)
    frequency = Column(Float) # Scenario frequency per unit time (e.g. per month)
    output_type = Column(String) # Enum reference
    output_description = Column(Text)
    repeatability_check = Column(Boolean, default=True)
    
    # Automation Lifecycle
    status = Column(String, default=AutomationStatus.CREATED.value)
    automation_notes = Column(Text, nullable=True)
    
    # ROI Metrics (Cached/Calculated)
    total_roi_saved_hours = Column(Float, default=0.0)
    
    tasks = relationship("Task", back_populates="workflow", cascade="all, delete-orphan", order_by="Task.order_index")

class Task(Base, BaseMixin):
    __tablename__ = "tasks"
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    name = Column(String)
    description = Column(Text)
    target_system = Column(String)
    
    # Time & Effort
    tat_minutes = Column(Float, default=0.0)
    occurrences_per_cycle = Column(Integer, default=1)
    
    # Failures & Recovery
    potential_mistakes = Column(Text, nullable=True)
    error_probability = Column(Float, default=0.0) # Percentage (0-100)
    recovery_time_minutes = Column(Float, default=0.0)
    
    order_index = Column(Integer, default=0)
    
    workflow = relationship("Workflow", back_populates="tasks")
    blockers = relationship("Blocker", back_populates="task", cascade="all, delete-orphan")

class Blocker(Base, BaseMixin):
    __tablename__ = "blockers"
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    blocking_entity = Column(String) # Enum reference
    reason = Column(Text)
    average_delay_minutes = Column(Float, default=0.0)
    standard_mitigation = Column(Text)
    
    task = relationship("Task", back_populates="blockers")

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
