"""add missing columns for workflow builder

Revision ID: 2a58cd4ec4ea
Revises: 919e2c751328
Create Date: 2026-04-21 07:14:03.009311

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a58cd4ec4ea'
down_revision: Union[str, Sequence[str], None] = '919e2c751328'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columns were already present due to a partial failed migration or manual addition
    # Only adding the missing index
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_tasks_node_id'), ['node_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_tasks_node_id'))
