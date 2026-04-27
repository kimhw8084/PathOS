"""add workflow adoption fields

Revision ID: b3f91c6a2d10
Revises: 8f2b7c1d9e44
Create Date: 2026-04-25 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3f91c6a2d10"
down_revision: Union[str, Sequence[str], None] = "8f2b7c1d9e44"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("workflows") as batch_op:
        batch_op.add_column(sa.Column("quick_capture_notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("template_key", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("ownership", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("governance", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("review_state", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("approval_state", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("required_reviewer_roles", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("review_requests", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("activity_timeline", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("notification_feed", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("related_workflow_ids", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("standards_profile", sa.JSON(), nullable=True))

    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("phase_name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("subflow_name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("task_block_key", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("decision_details", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("decision_details")
        batch_op.drop_column("task_block_key")
        batch_op.drop_column("subflow_name")
        batch_op.drop_column("phase_name")

    with op.batch_alter_table("workflows") as batch_op:
        batch_op.drop_column("standards_profile")
        batch_op.drop_column("related_workflow_ids")
        batch_op.drop_column("notification_feed")
        batch_op.drop_column("activity_timeline")
        batch_op.drop_column("review_requests")
        batch_op.drop_column("required_reviewer_roles")
        batch_op.drop_column("approval_state")
        batch_op.drop_column("review_state")
        batch_op.drop_column("governance")
        batch_op.drop_column("ownership")
        batch_op.drop_column("template_key")
        batch_op.drop_column("quick_capture_notes")
