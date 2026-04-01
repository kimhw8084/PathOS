import asyncio
import os
import random
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.database import Base, DATABASE_URL
from app.models.models import TaxonomyEnum, Workflow, Task, Blocker, AutomationStatus

async def seed_data():
    engine = create_async_engine(DATABASE_URL)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as session:
        # 1. Seed Taxonomy
        taxonomy_data = [
            # Trigger Types
            {"category": "TriggerType", "label": "OOC/OOS Alarm", "value": "ooc_oos_alarm"},
            {"category": "TriggerType", "label": "PIE Request", "value": "pie_request"},
            {"category": "TriggerType", "label": "YE Yield Excursion", "value": "ye_yield_excursion"},
            {"category": "TriggerType", "label": "Tool PM Recovery", "value": "tool_pm_recovery"},
            {"category": "TriggerType", "label": "Shift-ly Qual", "value": "shift_qual"},
            {"category": "TriggerType", "label": "New NPI Routing", "value": "new_npi_routing"},
            
            # Tool Types
            {"category": "ToolType", "label": "CD-SEM", "value": "cd_sem"},
            {"category": "ToolType", "label": "Overlay (OVL)", "value": "ovl"},
            {"category": "ToolType", "label": "Ellipsometry (Thickness)", "value": "ellipsometry"},
            {"category": "ToolType", "label": "Defect Inspection", "value": "defect_inspection"},
            
            # Workflow Types
            {"category": "WorkflowType", "label": "Recipe Creation/Mgmt", "value": "recipe_mgmt"},
            {"category": "WorkflowType", "label": "Tool Qualification", "value": "tool_qual"},
            {"category": "WorkflowType", "label": "Data Extraction/Reporting", "value": "data_reporting"},
            
            # Output Types
            {"category": "OutputType", "label": "Recipe Deployed", "value": "recipe_deployed"},
            {"category": "OutputType", "label": "Tool Released to Prod", "value": "tool_released"},
            {"category": "OutputType", "label": "Data Report Generated", "value": "report_generated"},
            
            # Blocking Entities
            {"category": "BlockingEntity", "label": "PIE", "value": "pie"},
            {"category": "BlockingEntity", "label": "YE", "value": "ye"},
            {"category": "BlockingEntity", "label": "IT/Network", "value": "it_network"},
            {"category": "BlockingEntity", "label": "Equipment Vendor", "value": "vendor"},
        ]
        
        for item in taxonomy_data:
            session.add(TaxonomyEnum(**item))
        
        # 2. Seed Workflows
        workflow_templates = [
            {
                "name": "Standard CD-SEM Recipe Creation",
                "trigger_type": "pie_request",
                "trigger_description": "Request from PIE for new layer measurement",
                "frequency": 20, # 20 times per month
                "output_type": "recipe_deployed",
                "output_description": "Recipe synced to s2github and tool local",
                "status": "In Automation",
            },
            {
                "name": "Shift-ly OVL Tool Qualification",
                "trigger_type": "shift_qual",
                "trigger_description": "Automated trigger at start of shift",
                "frequency": 90, # 3 shifts/day * 30 days
                "output_type": "tool_released",
                "output_description": "Tool status updated to GREEN in RMS",
                "status": "Created",
            }
        ]

        for wt in workflow_templates:
            wf = Workflow(**wt)
            session.add(wf)
            await session.flush() # Get ID

            # 3. Seed Tasks for each workflow
            if "CD-SEM" in wt["name"]:
                tasks = [
                    {"name": "Setup Job in RMS", "description": "Login to RMS and create task entry", "target_system": "RMS", "tat_minutes": 5, "order_index": 0},
                    {"name": "Image Capture Plan", "description": "Define coordinates for SEM images", "target_system": "CD-SEM UI", "tat_minutes": 15, "order_index": 1},
                    {"name": "Algorithm Tuning", "description": "Adjust edge detection parameters", "target_system": "Offline Server", "tat_minutes": 25, "order_index": 2},
                ]
            else:
                tasks = [
                    {"name": "Verify Qual Wafer", "description": "Ensure qual wafer is in stock and clean", "target_system": "MES", "tat_minutes": 10, "order_index": 0},
                    {"name": "Run Qual Recipe", "description": "Initiate measurement recipe", "target_system": "Tool Console", "tat_minutes": 20, "order_index": 1},
                ]

            for t_data in tasks:
                t_data["workflow_id"] = wf.id
                t_data["error_probability"] = random.randint(5, 15)
                t_data["recovery_time_minutes"] = random.randint(10, 30)
                task = Task(**t_data)
                session.add(task)
                await session.flush()

                # 4. Add a blocker to one task
                if t_data["order_index"] == 1:
                    blocker = Blocker(
                        task_id=task.id,
                        blocking_entity="vendor" if "CD-SEM" in wt["name"] else "it_network",
                        reason="Intermittent license server timeout",
                        average_delay_minutes=45,
                        standard_mitigation="Restart license service manually"
                    )
                    session.add(blocker)

        await session.commit()
        print("Database seeded successfully with dummy data!")

if __name__ == "__main__":
    asyncio.run(seed_data())
