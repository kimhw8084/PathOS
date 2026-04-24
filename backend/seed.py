import sys
import os

# Add the current directory to sys.path to ensure 'app' is importable when run directly
if os.getcwd() not in sys.path:
    sys.path.append(os.getcwd())

import asyncio
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import Base, DATABASE_URL
from app.models.models import (
    TaxonomyEnum, Workflow, Task, Blocker, TaskError, 
    AutomationStatus, SystemParameter, AuditLog, ParameterLog
)
from app.core.metrics import update_workflow_roi

async def seed_data():
    # 0. Ensure tables are created (using synchronous engine for metadata)
    from sqlalchemy import create_engine
    sync_url = DATABASE_URL.replace("sqlite+aiosqlite", "sqlite")
    sync_engine = create_engine(sync_url)
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()
    print("Database tables verified/created.")

    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # 1. Clear existing data
        from sqlalchemy import delete
        
        print("Clearing old data...")
        try:
            await session.execute(delete(AuditLog))
            await session.execute(delete(ParameterLog))
            await session.execute(delete(SystemParameter))
            await session.execute(delete(Blocker))
            await session.execute(delete(TaskError))
            await session.execute(delete(Task))
            await session.execute(delete(Workflow))
            await session.execute(delete(TaxonomyEnum))
            await session.commit()
        except Exception as e:
            print(f"Error clearing data: {e}")
            await session.rollback()
        
        print("Cleared old data.")

        # 2. System Parameters
        params = [
            {
                "key": "TOOL_ID",
                "label": "Applicable Tool ID",
                "description": "Specific metrology tool identifiers.",
                "is_dynamic": False,
                "manual_values": [f"CDSEM_{i:02d}" for i in range(1, 11)] + [f"OVL_{i:02d}" for i in range(1, 6)],
                "cached_values": [f"CDSEM_{i:02d}" for i in range(1, 11)] + [f"OVL_{i:02d}" for i in range(1, 6)],
                "has_discrepancy": False
            },
            {
                "key": "HARDWARE_FAMILY",
                "label": "Hardware Family",
                "description": "Metrology hardware classification.",
                "is_dynamic": False,
                "manual_values": ["Hitachi CG-6300", "KLA Archer 750", "ASML YieldStar", "TEL Tactras", "AMAT Verity"],
                "cached_values": ["Hitachi CG-6300", "KLA Archer 750", "ASML YieldStar", "TEL Tactras", "AMAT Verity"],
                "has_discrepancy": False
            },
            {
                "key": "WORKFLOW_TYPE",
                "label": "Workflow Operational Type",
                "description": "Classification of the workflow operational mode.",
                "is_dynamic": False,
                "manual_values": ["NPI_SETUP", "SPC_OOC", "PM_RECOVERY", "QUAL_SHIFT", "DATA_REPORTING"],
                "cached_values": ["NPI_SETUP", "SPC_OOC", "PM_RECOVERY", "QUAL_SHIFT", "DATA_REPORTING"],
                "has_discrepancy": False
            }
        ]
        for p in params:
            session.add(SystemParameter(**p))
        await session.flush()

        # 3. Taxonomy Seeding
        taxonomy_data = [
            {"category": "TriggerType", "label": "OOC/OOS Alarm", "value": "ooc_oos_alarm", "description": "Out of Control/Spec alarm from FDC/SPC."},
            {"category": "TriggerType", "label": "PIE Request", "value": "pie_request", "description": "Process Integration request for new layer/step."},
            {"category": "TriggerType", "label": "Tool PM Recovery", "value": "tool_pm_recovery", "description": "Returning tool to production after maintenance."},
            {"category": "TriggerType", "label": "Shift-ly Qual", "value": "shift_qual", "description": "Standard shift-based tool health check."},
            
            {"category": "ToolType", "label": "[CD-SEM] Critical Dimension", "value": "cd_sem"},
            {"category": "ToolType", "label": "[OVL] Overlay", "value": "ovl"},
            {"category": "ToolType", "label": "[ELLIP] Thin Film", "value": "ellipsometry"},
            
            {"category": "OutputType", "label": "Recipe Deployed", "value": "recipe_deployed"},
            {"category": "OutputType", "label": "Tool Released", "value": "tool_released"},
            {"category": "OutputType", "label": "Report Generated", "value": "report_generated"},
        ]
        
        for item in taxonomy_data:
            session.add(TaxonomyEnum(**item))
        await session.flush()

        # 4. Comprehensive Workflow Scenarios
        workflow_definitions = [
            {
                "name": "Advanced CD-SEM Gate Layer Metrology",
                "workspace": "Submitted Requests",
                "workflow_type": "NPI_SETUP",
                "tool_family": "cd_sem",
                "trigger_type": "pie_request",
                "trigger_description": "New PIE request for gate layer metrology setup.",
                "output_type": "recipe_deployed",
                "output_description": "Verified metrology recipe deployed to production.",
                "cadence_count": 5.0,
                "cadence_unit": "week",
                "status": AutomationStatus.IN_AUTOMATION.value,
                "description": "High-precision measurement setup for advanced gate layers.",
                "tasks": [
                    {
                        "name": "GDS Coordinate Fetch",
                        "desc": "Fetch measurement coordinates from Design DB.",
                        "interface_type": "API",
                        "manual_time": 10.0,
                        "machine_wait": 2.0,
                        "err_prob": 2.0,
                        "rec_time": 5.0,
                        "target_systems": [{"name": "DesignDB", "type": "API"}]
                    },
                    {
                        "name": "Manual Pattern Alignment",
                        "desc": "Operator manually aligns the SEM beam to the target pattern.",
                        "interface_type": "GUI",
                        "manual_time": 45.0,
                        "machine_wait": 0.0,
                        "err_prob": 15.0,
                        "rec_time": 30.0,
                        "risks_yield_scrap": True,
                        "target_systems": [{"name": "SEM-Console", "type": "GUI"}]
                    }
                ]
            },
            {
                "name": "Fully Automated Daily OVL Qual",
                "workspace": "Submitted Requests",
                "workflow_type": "QUAL_SHIFT",
                "tool_family": "ovl",
                "trigger_type": "shift_qual",
                "trigger_description": "Shift-based quality qualification trigger.",
                "output_type": "tool_released",
                "output_description": "Overlay tool released for production after successful qualification.",
                "cadence_count": 21.0, # 3 shifts * 7 days
                "cadence_unit": "week",
                "status": AutomationStatus.FULLY_AUTOMATED.value,
                "description": "Standard daily qualification for Overlay tools.",
                "tasks": [
                    {
                        "name": "Auto-Load Golden Wafer",
                        "desc": "Robotic arm loads the reference wafer.",
                        "interface_type": "API",
                        "manual_time": 0.0,
                        "machine_wait": 15.0,
                        "err_prob": 0.5,
                        "rec_time": 10.0,
                        "target_systems": [{"name": "MCS", "type": "API"}]
                    },
                    {
                        "name": "Automated Measurement Run",
                        "desc": "Tool executes pre-programmed measurement sequence.",
                        "interface_type": "API",
                        "manual_time": 2.0,
                        "machine_wait": 120.0,
                        "err_prob": 1.0,
                        "rec_time": 20.0,
                        "target_systems": [{"name": "YieldStar", "type": "Tool"}]
                    }
                ]
            },
            {
                "name": "Shadow IT Data Extract for YE",
                "workspace": "Submitted Requests",
                "workflow_type": "DATA_REPORTING",
                "tool_family": "all",
                "trigger_type": "ooc_oos_alarm",
                "trigger_description": "Yield Engineering data request following OOC alarm.",
                "output_type": "report_generated",
                "output_description": "Custom data dump for root cause analysis.",
                "cadence_count": 2.0,
                "cadence_unit": "month",
                "status": AutomationStatus.AUTOMATION_PLANNED.value,
                "description": "Manual extraction of data using undocumented Python scripts.",
                "tasks": [
                    {
                        "name": "Run 'raw_dump.py'",
                        "desc": "Execute local script to bypass DB lag.",
                        "interface_type": "Manual",
                        "manual_time": 20.0,
                        "machine_wait": 5.0,
                        "err_prob": 25.0,
                        "rec_time": 60.0,
                        "shadow_it_used": True,
                        "shadow_it_link": "http://personal-share/raw_dump.py",
                        "target_systems": [{"name": "Local Terminal", "type": "CLI"}]
                    }
                ]
            },
            {
                "name": "Highly Blocked NPI Hardware Setup",
                "workspace": "Submitted Requests",
                "workflow_type": "NPI_SETUP",
                "tool_family": "ellipsometry",
                "trigger_type": "pie_request",
                "trigger_description": "Request for new hardware configuration.",
                "output_type": "tool_released",
                "output_description": "Hardware configured and tool released for PIE use.",
                "cadence_count": 1.0,
                "cadence_unit": "month",
                "status": AutomationStatus.BACKLOG.value,
                "description": "Hardware configuration often blocked by Facilities or IT.",
                "tasks": [
                    {
                        "name": "Gas Line Validation",
                        "desc": "Confirm gas pressure for ellipsometry chamber.",
                        "interface_type": "Manual",
                        "manual_time": 60.0,
                        "machine_wait": 0.0,
                        "err_prob": 5.0,
                        "rec_time": 120.0,
                        "target_systems": [{"name": "Facilities Panel", "type": "Manual"}],
                        "blockers": [
                            {"entity": "Facilities", "reason": "Gas pressure sensor calibration pending", "prob": 80, "delay": 1440}
                        ]
                    }
                ]
            },
            {
                "name": "Multi-Shift Critical Path Recovery",
                "workspace": "Submitted Requests",
                "workflow_type": "PM_RECOVERY",
                "tool_family": "cd_sem",
                "trigger_type": "tool_pm_recovery",
                "trigger_description": "Post-PM recovery trigger.",
                "output_type": "tool_released",
                "output_description": "Tool successfully recovered and returned to production.",
                "cadence_count": 1.0,
                "cadence_unit": "month",
                "status": AutomationStatus.IN_AUTOMATION.value,
                "description": "Extremely long recovery workflow that triggers handoff risk flags.",
                "tasks": [
                    {
                        "name": "Full Column Realignment",
                        "desc": "Deep mechanical alignment of the SEM column.",
                        "interface_type": "Manual",
                        "manual_time": 480.0, # 8 hours
                        "machine_wait": 120.0,
                        "err_prob": 30.0,
                        "rec_time": 240.0,
                        "target_systems": [{"name": "SEM-Column", "type": "Hardware"}]
                    },
                    {
                        "name": "Stability Soak Test",
                        "desc": "Tool runs in idle state to ensure vacuum and thermal stability.",
                        "interface_type": "API",
                        "manual_time": 30.0,
                        "machine_wait": 600.0, # 10 hours
                        "err_prob": 5.0,
                        "rec_time": 60.0,
                        "target_systems": [{"name": "Tool-Health-Monitor", "type": "API"}]
                    }
                ]
            },
            {
                "name": "Cross-Tool Recipe Sync (Fleet)",
                "workspace": "Submitted Requests",
                "workflow_type": "NPI_SETUP",
                "tool_family": "ovl",
                "trigger_type": "pie_request",
                "trigger_description": "Fleet-wide recipe synchronization request.",
                "output_type": "recipe_deployed",
                "output_description": "Recipe synchronized across all fleet tools.",
                "cadence_count": 12.0,
                "cadence_unit": "year",
                "status": AutomationStatus.PARTIALLY_AUTOMATED.value,
                "description": "Synchronizing a new recipe across 12 different tools in the fleet.",
                "tasks": [
                    {
                        "name": "Master Recipe Creation",
                        "desc": "Create master template on tool OVL_01.",
                        "interface_type": "GUI",
                        "manual_time": 120.0,
                        "machine_wait": 0.0,
                        "err_prob": 10.0,
                        "rec_time": 60.0,
                        "target_systems": [{"name": "OVL_01", "type": "GUI"}]
                    },
                    {
                        "name": "Fleet Distribution",
                        "desc": "Push recipe to all other tools via RMS.",
                        "interface_type": "API",
                        "manual_time": 15.0,
                        "machine_wait": 30.0,
                        "err_prob": 2.0,
                        "rec_time": 30.0,
                        "occurrence": 11,
                        "target_systems": [{"name": "RMS", "type": "API"}]
                    }
                ]
            }
        ]

        # 5. Insert Workflows and nested data
        for wf_def in workflow_definitions:
            tasks_data = wf_def.pop("tasks")
            wf = Workflow(**wf_def)
            session.add(wf)
            await session.flush()

            for i, t_data in enumerate(tasks_data):
                blockers_data = t_data.pop("blockers", [])
                task = Task(
                    workflow_id=wf.id,
                    name=t_data["name"],
                    description=t_data["desc"],
                    interface_type=t_data["interface_type"],
                    manual_time_minutes=t_data["manual_time"],
                    active_touch_time_minutes=t_data["manual_time"], # Sync for legacy
                    machine_wait_time_minutes=t_data["machine_wait"],
                    target_systems=t_data["target_systems"],
                    shadow_it_used=t_data.get("shadow_it_used", False),
                    shadow_it_link=t_data.get("shadow_it_link"),
                    risks_yield_scrap=t_data.get("risks_yield_scrap", False),
                    order_index=i,
                    occurrence=t_data.get("occurrence", 1)
                )
                session.add(task)
                await session.flush()

                # Add error models
                error = TaskError(
                    task_id=task.id,
                    error_type="Human_Error" if t_data["interface_type"] == "GUI" else "System_Error",
                    description=f"Standard error during {t_data['name']}.",
                    probability_percent=t_data["err_prob"],
                    recovery_time_minutes=t_data["rec_time"]
                )
                session.add(error)

                # Add explicit blockers
                for b_data in blockers_data:
                    blocker = Blocker(
                        task_id=task.id,
                        blocking_entity=b_data["entity"],
                        reason=b_data["reason"],
                        probability_percent=b_data["prob"],
                        average_delay_minutes=b_data["delay"],
                        standard_mitigation="Escalate to department head."
                    )
                    session.add(blocker)

                # Add random blockers if not already blocked
                if not blockers_data and random.random() > 0.8:
                    blocker = Blocker(
                        task_id=task.id,
                        blocking_entity=random.choice(["IT", "YE", "PIE"]),
                        reason="Standard cross-departmental delay.",
                        probability_percent=random.randint(5, 20),
                        average_delay_minutes=random.randint(60, 480),
                        standard_mitigation="Follow up via email."
                    )
                    session.add(blocker)
            
            # Reload workflow with ALL relationships to prevent MissingGreenlet
            wf_res = await session.execute(
                select(Workflow)
                .where(Workflow.id == wf.id)
                .options(
                    selectinload(Workflow.tasks).selectinload(Task.errors),
                    selectinload(Workflow.tasks).selectinload(Task.blockers)
                )
            )
            wf_loaded = wf_res.scalar_one()
            await update_workflow_roi(wf_loaded)
            await session.commit()
            print(f"Workflow '{wf.name}' seeded. ROI: {wf_loaded.total_roi_saved_hours:.2f}h/wk")

    print("Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_data())
