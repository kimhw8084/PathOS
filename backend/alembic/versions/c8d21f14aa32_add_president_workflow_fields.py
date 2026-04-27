"""add president workflow fields

Revision ID: c8d21f14aa32
Revises: b3f91c6a2d10
Create Date: 2026-04-25 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c8d21f14aa32"
down_revision = "b3f91c6a2d10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("workflow_executions") as batch_op:
        batch_op.add_column(sa.Column("workflow_version", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("workflow_name_snapshot", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("automation_status_snapshot", sa.String(), nullable=True))

    with op.batch_alter_table("automation_projects") as batch_op:
        batch_op.add_column(sa.Column("traceability", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("benefits_realization", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("exception_governance", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("delivery_metrics", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("automation_projects") as batch_op:
        batch_op.drop_column("delivery_metrics")
        batch_op.drop_column("exception_governance")
        batch_op.drop_column("benefits_realization")
        batch_op.drop_column("traceability")

    with op.batch_alter_table("workflow_executions") as batch_op:
        batch_op.drop_column("automation_status_snapshot")
        batch_op.drop_column("workflow_name_snapshot")
        batch_op.drop_column("workflow_version")
