"""add operations tracking tables

Revision ID: 8f2b7c1d9e44
Revises: 4c6f5d7e8a91
Create Date: 2026-04-24 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f2b7c1d9e44"
down_revision: Union[str, Sequence[str], None] = "4c6f5d7e8a91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "workflow_executions",
        sa.Column("workflow_id", sa.Integer(), nullable=False),
        sa.Column("execution_started_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("execution_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_by", sa.String(), nullable=True),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("site", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("actual_duration_minutes", sa.Float(), nullable=True),
        sa.Column("baseline_manual_minutes", sa.Float(), nullable=True),
        sa.Column("automated_duration_minutes", sa.Float(), nullable=True),
        sa.Column("wait_duration_minutes", sa.Float(), nullable=True),
        sa.Column("recovery_time_minutes", sa.Float(), nullable=True),
        sa.Column("exception_count", sa.Integer(), nullable=True),
        sa.Column("automation_coverage_percent", sa.Float(), nullable=True),
        sa.Column("blockers_encountered", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["workflow_id"], ["workflows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_workflow_executions_id"), "workflow_executions", ["id"], unique=False)
    op.create_index(op.f("ix_workflow_executions_workflow_id"), "workflow_executions", ["workflow_id"], unique=False)

    op.create_table(
        "automation_projects",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("workflow_ids", sa.JSON(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("owner", sa.String(), nullable=True),
        sa.Column("sponsor", sa.String(), nullable=True),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("priority", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("health", sa.String(), nullable=True),
        sa.Column("progress_percent", sa.Float(), nullable=True),
        sa.Column("target_completion_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("projected_hours_saved_weekly", sa.Float(), nullable=True),
        sa.Column("realized_hours_saved_weekly", sa.Float(), nullable=True),
        sa.Column("blocker_summary", sa.JSON(), nullable=True),
        sa.Column("milestone_summary", sa.JSON(), nullable=True),
        sa.Column("next_action", sa.Text(), nullable=True),
        sa.Column("last_update", sa.Text(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_automation_projects_id"), "automation_projects", ["id"], unique=False)
    op.create_index(op.f("ix_automation_projects_name"), "automation_projects", ["name"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_automation_projects_name"), table_name="automation_projects")
    op.drop_index(op.f("ix_automation_projects_id"), table_name="automation_projects")
    op.drop_table("automation_projects")
    op.drop_index(op.f("ix_workflow_executions_workflow_id"), table_name="workflow_executions")
    op.drop_index(op.f("ix_workflow_executions_id"), table_name="workflow_executions")
    op.drop_table("workflow_executions")
