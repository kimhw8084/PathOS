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
        # 1. Clear existing data
        from sqlalchemy import delete
        await session.execute(delete(Blocker))
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
            {"category": "TriggerType", "label": "Customer Audit", "value": "customer_audit", "description": "External/Internal quality audit trigger."},
            
            # Tool Types
            {"category": "ToolType", "label": "CD-SEM", "value": "cd_sem"},
            {"category": "ToolType", "label": "Overlay (OVL)", "value": "ovl"},
            {"category": "ToolType", "label": "Ellipsometry", "value": "ellipsometry"},
            {"category": "ToolType", "label": "Defect Inspection", "value": "defect_inspection"},
            {"category": "ToolType", "label": "XRF/XRD", "value": "xrf_xrd"},
            {"category": "ToolType", "label": "AFM", "value": "afm"},
            
            # Workflow Types
            {"category": "WorkflowType", "label": "Recipe Creation/Mgmt", "value": "recipe_mgmt"},
            {"category": "WorkflowType", "label": "Tool Qualification", "value": "tool_qual"},
            {"category": "WorkflowType", "label": "Data Extraction/Reporting", "value": "data_reporting"},
            {"category": "WorkflowType", "label": "Measurement Setup", "value": "measurement_setup"},
            {"category": "WorkflowType", "label": "Tool Matching", "value": "tool_matching"},
            
            # Output Types
            {"category": "OutputType", "label": "Recipe Deployed", "value": "recipe_deployed"},
            {"category": "OutputType", "label": "Tool Released to Prod", "value": "tool_released"},
            {"category": "OutputType", "label": "Data Report Generated", "value": "report_generated"},
            {"category": "OutputType", "label": "Lot Released", "value": "lot_released"},
            {"category": "OutputType", "label": "Parameter Updated", "value": "parameter_updated"},
            {"category": "OutputType", "label": "SOP Documentation", "value": "sop_docs"},
            
            # Blocking Entities
            {"category": "BlockingEntity", "label": "PIE", "value": "PIE"},
            {"category": "BlockingEntity", "label": "YE", "value": "YE"},
            {"category": "BlockingEntity", "label": "Module", "value": "Module"},
            {"category": "BlockingEntity", "label": "IT/Network", "value": "IT/Network"},
            {"category": "BlockingEntity", "label": "Equipment Vendor", "value": "Equipment Vendor"},
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
                "frequency": 12,
                "output_type": "recipe_deployed",
                "output_description": "Production-ready recipe synced to tool clusters.",
                "status": "In Automation",
                "tasks": [
                    {"name": "GDS Coordinate Extraction", "target_system": "Design DB", "tat": 15, "err": 5, "rec": 20, "desc": "Extracting coordinates from GDS design file for measurement points."},
                    {"name": "Site Pattern Selection", "target_system": "SEM Interface", "tat": 30, "err": 15, "rec": 45, "desc": "Manual selection of unique patterns for pattern recognition."},
                    {"name": "Edge Detection Tuning", "target_system": "Offline Server", "tat": 40, "err": 10, "rec": 30, "desc": "Algorithm parameter adjustment for contrast optimization."},
                    {"name": "Cluster Deployment", "target_system": "RMS", "tat": 10, "err": 2, "rec": 10, "desc": "Syncing recipe to the entire tool cluster."}
                ]
            },
            {
                "name": "Daily OVL Tool Matching Protocol",
                "trigger_type": "shift_qual",
                "trigger_description": "Shift-ly cross-tool matching to ensure overlay consistency.",
                "frequency": 90,
                "output_type": "report_generated",
                "output_description": "Matching matrix and tool bias report.",
                "status": "Fully Automated",
                "tasks": [
                    {"name": "Standard Wafer Load", "target_system": "OVL Tool", "tat": 5, "err": 5, "rec": 15, "desc": "Loading golden matching wafer into tool stage."},
                    {"name": "Bias Calculation Run", "target_system": "Matching Engine", "tat": 20, "err": 2, "rec": 10, "desc": "Automated execution of matching sequence."},
                    {"name": "SPC Update", "target_system": "SPC System", "tat": 5, "err": 1, "rec": 5, "desc": "Pushing matching deltas to SPC charts."}
                ]
            },
            {
                "name": "Critical Yield Excursion - Metal 1",
                "trigger_type": "ye_yield_excursion",
                "trigger_description": "Yield drop detected at Metal 1 layer; requiring emergency inspection.",
                "frequency": 4,
                "output_type": "lot_released",
                "output_description": "Lot cleared for processing after defect confirmation.",
                "status": "Priority Measurement",
                "tasks": [
                    {"name": "Defect Map Correlation", "target_system": "Klarity", "tat": 60, "err": 20, "rec": 90, "desc": "Correlating in-line defect maps with yield loss zones."},
                    {"name": "Manual Review (SEM)", "target_system": "Review SEM", "tat": 120, "err": 25, "rec": 60, "desc": "Manual identification of killer defects."},
                    {"name": "Engineering Disposition", "target_system": "MES", "tat": 30, "err": 5, "rec": 30, "desc": "Technical sign-off for lot release."}
                ]
            },
            {
                "name": "Ellipsometry Thin Film Qual",
                "trigger_type": "tool_pm_recovery",
                "trigger_description": "Post-PM qualification for high-K dielectric thickness.",
                "frequency": 8,
                "output_type": "tool_released",
                "output_description": "Tool status set to GREEN in RMS.",
                "status": "Backlog",
                "tasks": [
                    {"name": "Dummy Wafer Prep", "target_system": "Manual", "tat": 10, "err": 5, "rec": 10, "desc": "Cleaning and prepping dummy wafers for thickness check."},
                    {"name": "Recipe Stability Check", "target_system": "Ellipsometer", "tat": 45, "err": 10, "rec": 40, "desc": "Running 5-site thickness check for repeatability."},
                    {"name": "RMS Status Update", "target_system": "RMS", "tat": 5, "err": 0, "rec": 0, "desc": "Updating tool readiness flag."}
                ]
            },
            {
                "name": "NPI Routing for New Node Logic",
                "trigger_type": "new_npi_routing",
                "trigger_description": "Initial routing setup for the 2nm logic development cycle.",
                "frequency": 2,
                "output_type": "sop_docs",
                "output_description": "Comprehensive routing SOP and measurement plan.",
                "status": "Automation Brainstorming",
                "tasks": [
                    {"name": "Layer Stack Review", "target_system": "Integration Portal", "tat": 90, "err": 10, "rec": 120, "desc": "Reviewing material stack for optical transparency issues."},
                    {"name": "Measurement Plan Design", "target_system": "Excel/Wiki", "tat": 180, "err": 15, "rec": 60, "desc": "Drafting the primary measurement matrix for the node."},
                    {"name": "Feedback Loop Setup", "target_system": "Internal API", "tat": 60, "err": 30, "rec": 120, "desc": "Designing the data push from tool to analysis scripts."}
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
                    tat_minutes=t_data["tat"],
                    error_probability=t_data["err"],
                    recovery_time_minutes=t_data["rec"],
                    description=t_data["desc"],
                    order_index=i,
                    occurrences_per_cycle=random.randint(1, 3),
                    potential_mistakes=f"Human error during {t_data['name']} execution; leading to data rework."
                )
                session.add(task)
                await session.flush()

                # Add random blockers to some tasks
                if random.random() > 0.6:
                    blocker = Blocker(
                        task_id=task.id,
                        blocking_entity=random.choice(["PIE", "YE", "IT/Network", "Equipment Vendor"]),
                        reason="Intermittent access/connectivity issues or data unavailability.",
                        average_delay_minutes=random.randint(30, 120),
                        standard_mitigation="Escalate via Jira and wait for manual override."
                    )
                    session.add(blocker)

            # Update ROI for each workflow based on seeded tasks
            from app.core.metrics import update_workflow_roi
            # Need to reload with tasks
            from sqlalchemy.orm import selectinload
            from sqlalchemy.future import select
            res = await session.execute(select(Workflow).where(Workflow.id == wf.id).options(selectinload(Workflow.tasks)))
            wf_with_tasks = res.scalar_one()
            update_workflow_roi(wf_with_tasks)

        await session.commit()
        print(f"PathOS Ecosystem seeded with {len(workflow_definitions)} high-fidelity metrology workflows!")

if __name__ == "__main__":
    asyncio.run(seed_data())
