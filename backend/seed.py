import asyncio
import os
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from app.database import Base, DATABASE_URL
from app.models.models import (
    TaxonomyEnum, Workflow, Task, Blocker, TaskError, 
    AutomationStatus, SystemParameter, AuditLog
)
from app.core.metrics import update_workflow_roi

async def seed_data():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # 1. Clear existing data
        from sqlalchemy import delete, text
        
        # Safe deletion of AuditLog (might not exist if migration didn't run)
        try:
            await session.execute(delete(AuditLog))
        except Exception:
            print("AuditLog table not found or already cleared, skipping...")
            
        await session.execute(delete(SystemParameter))
        await session.execute(delete(Blocker))
        await session.execute(delete(TaskError))
        await session.execute(delete(Task))
        await session.execute(delete(Workflow))
        await session.execute(delete(TaxonomyEnum))
        await session.commit()
        
        print("Cleared old data.")

        # 2. System Parameters (Dynamic Connectors)
        params = [
            {
                "key": "TOOL_ID",
                "label": "Specific Tool ID",
                "description": "Dynamic retrieval of active metrology tool IDs from production database.",
                "is_dynamic": True,
                "python_code": "import random\nresult = [f'CDSEM_{i:02d}' for i in range(1, 15)] + [f'OVL_{i:02d}' for i in range(1, 8)]",
                "manual_values": []
            },
            {
                "key": "WAFER_SIZE",
                "label": "Wafer Size (mm)",
                "description": "Standard production wafer sizes.",
                "is_dynamic": False,
                "python_code": None,
                "manual_values": ["300", "200", "150"]
            },
            {
                "key": "FAB_LOCATION",
                "label": "Fab Location",
                "description": "Physical fab building identifier.",
                "is_dynamic": False,
                "python_code": None,
                "manual_values": ["12-S3", "12-S1", "15-S4"]
            }
        ]
        for p in params:
            session.add(SystemParameter(**p))
        await session.flush()

        # 3. Taxonomy Seeding
        taxonomy_data = [
            # Trigger Types
            {"category": "TriggerType", "label": "OOC/OOS Alarm", "value": "ooc_oos_alarm", "description": "Out of Control/Spec alarm from FDC/SPC."},
            {"category": "TriggerType", "label": "PIE Request", "value": "pie_request", "description": "Process Integration request for new layer/step."},
            {"category": "TriggerType", "label": "YE Yield Excursion", "value": "ye_yield_excursion", "description": "Yield Enhancement investigation trigger."},
            {"category": "TriggerType", "label": "Tool PM Recovery", "value": "tool_pm_recovery", "description": "Returning tool to production after maintenance."},
            {"category": "TriggerType", "label": "Shift-ly Qual", "value": "shift_qual", "description": "Standard shift-based tool health check."},
            {"category": "TriggerType", "label": "New NPI Routing", "value": "new_npi_routing", "description": "New Product Introduction routing setup."},
            
            # Tool Families
            {"category": "ToolType", "label": "[CD-SEM] Critical Dimension", "value": "cd_sem"},
            {"category": "ToolType", "label": "[OVL] Overlay", "value": "ovl"},
            {"category": "ToolType", "label": "[ELLIP] Thin Film", "value": "ellipsometry"},
            {"category": "ToolType", "label": "[DEFECT] Inspection", "value": "defect_inspection"},
            
            # Output Types
            {"category": "OutputType", "label": "Recipe Deployed", "value": "recipe_deployed"},
            {"category": "OutputType", "label": "Tool Released", "value": "tool_released"},
            {"category": "OutputType", "label": "Lot Released", "value": "lot_released"},
            {"category": "OutputType", "label": "SOP Docs", "value": "sop_docs"},
            {"category": "OutputType", "label": "Report Generated", "value": "report_generated"},
        ]
        
        for item in taxonomy_data:
            session.add(TaxonomyEnum(**item))
        await session.flush()

        # 4. Workflow Seeding
        workflow_definitions = [
            {
                "name": "Advanced CD-SEM Gate Layer Recipe Creation",
                "version": "v1.2.0",
                "tool_family": "cd_sem",
                "trigger_type": "new_npi_routing",
                "trigger_description": "New NPI Gate layer requires high-precision CD-SEM measurement for gate width control.",
                "frequency": 12.0,
                "output_type": "recipe_deployed",
                "output_description": "Production-ready recipe synced to tool clusters across all shifts.",
                "repeatability_check": True,
                "involves_equipment": True,
                "equipment_state": "Local",
                "cleanroom_execution_required": False,
                "status": AutomationStatus.IN_AUTOMATION.value,
                "yield_risk": True,
                "flow_summary": "NPI Request -> Design DB Coord Ext -> Pattern Match -> Edge Detection Tune -> Recipe Deploy",
                "automation_notes": "Currently automating the coordinate extraction via Python script.",
                "tasks": [
                    {
                        "name": "GDS Coordinate Extraction", 
                        "target_system": "Design DB", 
                        "interface_type": "API",
                        "active_touch": 15.0, 
                        "machine_wait": 0.0,
                        "occurrences": 1,
                        "desc": "Extracting coordinates from GDS design file for measurement points.",
                        "shadow_it_used": True,
                        "shadow_it_link": "http://internal-git/scripts/gds_ext.py",
                        "source_data": "GDS Layout Files",
                        "output_format": "CSV (X,Y Coords)",
                        "err_prob": 5.0, 
                        "rec_time": 20.0,
                        "risks_yield_scrap": False
                    },
                    {
                        "name": "Site Pattern Selection", 
                        "target_system": "SEM Interface", 
                        "interface_type": "GUI",
                        "active_touch": 30.0, 
                        "machine_wait": 45.0,
                        "occurrences": 1,
                        "desc": "Manual selection of unique patterns for pattern recognition.",
                        "source_data": "Live SEM Image",
                        "err_prob": 15.0, 
                        "rec_time": 45.0,
                        "risks_yield_scrap": True,
                        "tribal_knowledge": "Operator must avoid grainy areas near the wafer edge for better pattern recognition."
                    },
                    {
                        "name": "Edge Detection Tuning", 
                        "target_system": "Offline Server", 
                        "interface_type": "GUI",
                        "active_touch": 40.0, 
                        "machine_wait": 20.0,
                        "occurrences": 1,
                        "desc": "Algorithm parameter adjustment for contrast optimization.",
                        "err_prob": 10.0, 
                        "rec_time": 30.0,
                        "risks_yield_scrap": False
                    }
                ]
            },
            {
                "name": "Daily OVL Tool Matching Protocol (300mm)",
                "version": "v3.1.5",
                "tool_family": "ovl",
                "trigger_type": "shift_qual",
                "trigger_description": "Shift-ly cross-tool matching to ensure overlay consistency across the fleet.",
                "frequency": 90.0,
                "output_type": "report_generated",
                "output_description": "Matching matrix and tool bias report for tool owner approval.",
                "repeatability_check": True,
                "involves_equipment": True,
                "equipment_state": "Run",
                "cleanroom_execution_required": True,
                "status": AutomationStatus.FULLY_AUTOMATED.value,
                "yield_risk": False,
                "flow_summary": "Shift Start -> Load Golden Wafer -> Run Matching Sequence -> Data Analysis -> Report",
                "automation_notes": "Matching sequence is fully scripted. Data analysis is now automated via PathOS dynamic connector.",
                "tasks": [
                    {
                        "name": "Standard Wafer Load", 
                        "target_system": "OVL Tool", 
                        "interface_type": "Manual",
                        "active_touch": 5.0, 
                        "machine_wait": 10.0,
                        "occurrences": 1,
                        "desc": "Loading golden matching wafer into tool stage.",
                        "err_prob": 5.0, 
                        "rec_time": 15.0,
                        "risks_yield_scrap": False
                    },
                    {
                        "name": "Bias Calculation Run", 
                        "target_system": "Matching Engine", 
                        "interface_type": "DB",
                        "active_touch": 20.0, 
                        "machine_wait": 120.0,
                        "occurrences": 2,
                        "desc": "Automated execution of matching sequence on two reference tools.",
                        "err_prob": 2.0, 
                        "rec_time": 10.0,
                        "risks_yield_scrap": False,
                        "post_verification": "Check if bias is within +/- 1.5nm."
                    }
                ]
            },
            {
                "name": "Post-PM Ellipsometry Calibration",
                "version": "v1.0.1",
                "tool_family": "ellipsometry",
                "trigger_type": "tool_pm_recovery",
                "trigger_description": "Recovery procedure for thin-film tools after preventive maintenance.",
                "frequency": 4.0,
                "output_type": "tool_released",
                "output_description": "Tool health certification and release to production.",
                "repeatability_check": True,
                "involves_equipment": True,
                "equipment_state": "Down",
                "cleanroom_execution_required": False,
                "status": AutomationStatus.AUTOMATION_PLANNED.value,
                "yield_risk": True,
                "flow_summary": "PM Finish -> Calibrate Light Source -> Measure Reference Film -> Validate Accuracy -> Release",
                "tasks": [
                    {
                        "name": "Light Source Alignment",
                        "target_system": "Tool Console",
                        "interface_type": "GUI",
                        "active_touch": 60.0,
                        "machine_wait": 0.0,
                        "occurrences": 1,
                        "desc": "Manual alignment of laser/UV source for peak intensity.",
                        "err_prob": 25.0,
                        "rec_time": 60.0,
                        "risks_yield_scrap": False
                    },
                    {
                        "name": "Accuracy Validation",
                        "target_system": "SPC System",
                        "interface_type": "Web",
                        "active_touch": 15.0,
                        "machine_wait": 5.0,
                        "occurrences": 3,
                        "desc": "Verification of measurement results against historical control charts.",
                        "err_prob": 10.0,
                        "rec_time": 20.0,
                        "risks_yield_scrap": False
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
                task = Task(
                    workflow_id=wf.id,
                    name=t_data["name"],
                    description=t_data["desc"],
                    target_system=t_data["target_system"],
                    interface_type=t_data["interface_type"],
                    active_touch_time_minutes=t_data["active_touch"],
                    machine_wait_time_minutes=t_data["machine_wait"],
                    occurrences_per_cycle=t_data.get("occurrences", 1),
                    shadow_it_used=t_data.get("shadow_it_used", False),
                    shadow_it_link=t_data.get("shadow_it_link"),
                    source_data=t_data.get("source_data"),
                    output_format_example=t_data.get("output_format"),
                    post_task_verification=t_data.get("post_verification"),
                    risks_yield_scrap=t_data.get("risks_yield_scrap", False),
                    tribal_knowledge=t_data.get("tribal_knowledge"),
                    order_index=i
                )
                session.add(task)
                await session.flush()

                # Add error models
                error = TaskError(
                    task_id=task.id,
                    error_type="Human_Interface_Error" if t_data["interface_type"] == "GUI" else "System_Timeout",
                    description=f"Mistake during {t_data['name']} parameter entry or execution.",
                    probability_percent=t_data["err_prob"],
                    recovery_time_minutes=t_data["rec_time"]
                )
                session.add(error)

                # Add random blockers
                if random.random() > 0.4:
                    blocker = Blocker(
                        task_id=task.id,
                        blocking_entity=random.choice(["PIE", "YE", "IT/Network", "Facilities"]),
                        reason="Waiting for upstream data approval or tool availability.",
                        probability_percent=random.randint(10, 50),
                        average_delay_minutes=random.randint(30, 240),
                        standard_mitigation="Escalate via ticketing system."
                    )
                    session.add(blocker)
            
            # Reload workflow with relationships to calculate ROI
            wf_res = await session.execute(
                select(Workflow)
                .where(Workflow.id == wf.id)
                .options(selectinload(Workflow.tasks).selectinload(Task.errors))
            )
            wf_loaded = wf_res.scalar_one()
            update_workflow_roi(wf_loaded)
            await session.commit()
            print(f"Workflow '{wf.name}' seeded with ROI: {wf_loaded.total_roi_saved_hours:.2f}h")

    print("Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_data())
