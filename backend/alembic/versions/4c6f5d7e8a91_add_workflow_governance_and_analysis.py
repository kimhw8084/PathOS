"""add workflow governance and analysis fields

Revision ID: 4c6f5d7e8a91
Revises: 2a58cd4ec4ea
Create Date: 2026-04-24 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4c6f5d7e8a91"
down_revision: Union[str, Sequence[str], None] = "2a58cd4ec4ea"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("workflows", schema=None) as batch_op:
        batch_op.add_column(sa.Column("workspace", sa.String(), nullable=True, server_default="Submitted Requests"))
        batch_op.add_column(sa.Column("parent_workflow_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("version_group", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("version_notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("version_base_snapshot", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("equipment_required", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("equipment_state", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("cleanroom_required", sa.Boolean(), nullable=True, server_default=sa.text("0")))
        batch_op.add_column(sa.Column("access_control", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("comments", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("analysis", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("simulation", sa.JSON(), nullable=True))
        batch_op.create_foreign_key("fk_workflows_parent_workflow_id", "workflows", ["parent_workflow_id"], ["id"])

    with op.batch_alter_table("tasks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("diagnostics", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks", schema=None) as batch_op:
        batch_op.drop_column("diagnostics")

    with op.batch_alter_table("workflows", schema=None) as batch_op:
        batch_op.drop_constraint("fk_workflows_parent_workflow_id", type_="foreignkey")
        batch_op.drop_column("simulation")
        batch_op.drop_column("analysis")
        batch_op.drop_column("comments")
        batch_op.drop_column("access_control")
        batch_op.drop_column("cleanroom_required")
        batch_op.drop_column("equipment_state")
        batch_op.drop_column("equipment_required")
        batch_op.drop_column("version_base_snapshot")
        batch_op.drop_column("version_notes")
        batch_op.drop_column("version_group")
        batch_op.drop_column("parent_workflow_id")
        batch_op.drop_column("workspace")
