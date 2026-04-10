import asyncio
import os
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.database import Base, DATABASE_URL
from app.models.models import TaxonomyEnum, Workflow, Task, Blocker, TaskError, AutomationStatus

async def seed_data():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # 1. Clear existing data
        from sqlalchemy import delete
        await session.execute(delete(Blocker))
        await session.execute(delete(TaskError))
        await session.execute(delete(Task))
        await session.execute(delete(Workflow))
        await session.execute(delete(TaxonomyEnum))
        await session.commit()

        # 2. Comprehensive Taxonomy Seeding
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
        ]
        
        for item in taxonomy_data:
            session.add(TaxonomyEnum(**item))
        await session.flush()

        # 3. High-Volume Workflow Seeding
        workflow_definitions = [
            {
                "name": "Advanced CD-SEM Gate Layer Recipe",
                "trigger_type": "new_npi_routing",
                "trigger_description": "New NPI Gate layer requires high-precision CD-SEM measurement.",
                "frequency": 12.0,
                "output_type": "recipe_deployed",
                "output_description": "Production-ready recipe synced to tool clusters.",
                "status": "In Automation",
                "tool_family": "cd_sem",
                "tasks": [
                    {
                        "name": "GDS Coordinate Extraction", 
                        "target_system": "Design DB", 
                        "active_touch": 15.0, 
                        "machine_wait": 0.0,
                        "err_prob": 5.0, 
                        "rec_time": 20.0, 
                        "desc": "Extracting coordinates from GDS design file for measurement points."
                    },
                    {
                        "name": "Site Pattern Selection", 
                        "target_system": "SEM Interface", 
                        "active_touch": 30.0, 
                        "machine_wait": 45.0,
                        "err_prob": 15.0, 
                        "rec_time": 45.0, 
                        "desc": "Manual selection of unique patterns for pattern recognition."
                    },
                    {
                        "name": "Edge Detection Tuning", 
                        "target_system": "Offline Server", 
                        "active_touch": 40.0, 
                        "machine_wait": 20.0,
                        "err_prob": 10.0, 
                        "rec_time": 30.0, 
                        "desc": "Algorithm parameter adjustment for contrast optimization."
                    }
                ]
            },
            {
                "name": "Daily OVL Tool Matching Protocol",
                "trigger_type": "shift_qual",
                "trigger_description": "Shift-ly cross-tool matching to ensure overlay consistency.",
                "frequency": 90.0,
                "output_type": "report_generated",
                "output_description": "Matching matrix and tool bias report.",
                "status": "Fully Automated",
                "tool_family": "ovl",
                "tasks": [
                    {
                        "name": "Standard Wafer Load", 
                        "target_system": "OVL Tool", 
                        "active_touch": 5.0, 
                        "machine_wait": 10.0,
                        "err_prob": 5.0, 
                        "rec_time": 15.0, 
                        "desc": "Loading golden matching wafer into tool stage."
                    },
                    {
                        "name": "Bias Calculation Run", 
                        "target_system": "Matching Engine", 
                        "active_touch": 20.0, 
                        "machine_wait": 120.0,
                        "err_prob": 2.0, 
                        "rec_time": 10.0, 
                        "desc": "Automated execution of matching sequence."
                    }
                ]
            }
        ]

        # 4. Insert Workflows and nested data
        for wf_def in workflow_definitions:
            tasks_data = wf_def.pop("tasks")
            wf = Workflow(**wf_def)
            session.add(wf)
            await session.flush()

            for i, t_data in enumerate(tasks_data):
                task = Task(
                    workflow_id=wf.id,
                    name=t_data["name"],
                    target_system=t_data["target_system"],
                    active_touch_time_minutes=t_data["active_touch"],
                    machine_wait_time_minutes=t_data["machine_wait"],
                    description=t_data["desc"],
                    order_index=i,
                    occurrences_per_cycle=random.randint(1, 3)
                )
                session.add(task)
                await session.flush()

                # Add error models
                error = TaskError(
                    task_id=task.id,
                    error_type="Human_Interface_Error",
                    description=f"Mistake during {t_data['name']} parameter entry.",
                    probability_percent=t_data["err_prob"],
                    recovery_time_minutes=t_data["rec_time"]
                )
                session.add(error)

                # Add random blockers
                if random.random() > 0.5:
                    blocker = Blocker(
                        task_id=task.id,
                        blocking_entity=random.choice(["PIE", "YE", "IT/Network"]),
                        reason="Standard cross-departmental data delay.",
                        average_delay_minutes=random.randint(30, 120),
                        standard_mitigation="Escalate via standard portal."
                    )
                    session.add(blocker)

        await session.commit()
        print(f"PathOS Database re-seeded for Phase 1 Design.")

if __name__ == "__main__":
    asyncio.run(seed_data())
