"""add versioned identity source tables

Revision ID: 7f4c2b6a9f01
Revises: e1a9d7b44c20
Create Date: 2026-04-30 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "7f4c2b6a9f01"
down_revision = "e1a9d7b44c20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "identity_sources",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=True),
        sa.Column("working_dir", sa.String(), nullable=True),
        sa.Column("venv_path", sa.String(), nullable=True),
        sa.Column("script_path", sa.String(), nullable=True),
        sa.Column("script_content", sa.Text(), nullable=True),
        sa.Column("schedule", sa.String(), nullable=True),
        sa.Column("schema_version", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("current_version", sa.Integer(), nullable=True),
        sa.Column("current_snapshot_id", sa.Integer(), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_status", sa.String(), nullable=True),
        sa.Column("last_run_message", sa.Text(), nullable=True),
        sa.Column("last_run_row_count", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_identity_sources_id"), "identity_sources", ["id"], unique=False)

    op.create_table(
        "identity_source_snapshots",
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=True),
        sa.Column("run_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("actor", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("added_count", sa.Integer(), nullable=True),
        sa.Column("updated_count", sa.Integer(), nullable=True),
        sa.Column("removed_count", sa.Integer(), nullable=True),
        sa.Column("source_hash", sa.String(), nullable=True),
        sa.Column("diff_summary", sa.JSON(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["source_id"], ["identity_sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_identity_source_snapshots_id"), "identity_source_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_identity_source_snapshots_source_id"), "identity_source_snapshots", ["source_id"], unique=False)

    op.create_table(
        "identity_source_snapshot_rows",
        sa.Column("snapshot_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("org", sa.String(), nullable=True),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("site", sa.String(), nullable=True),
        sa.Column("manager", sa.String(), nullable=True),
        sa.Column("roles", sa.JSON(), nullable=True),
        sa.Column("permissions", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("row_state", sa.String(), nullable=True),
        sa.Column("source_hash", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["snapshot_id"], ["identity_source_snapshots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_identity_source_snapshot_rows_id"), "identity_source_snapshot_rows", ["id"], unique=False)
    op.create_index(op.f("ix_identity_source_snapshot_rows_snapshot_id"), "identity_source_snapshot_rows", ["snapshot_id"], unique=False)
    op.create_index(op.f("ix_identity_source_snapshot_rows_employee_id"), "identity_source_snapshot_rows", ["employee_id"], unique=False)
    op.create_index(op.f("ix_identity_source_snapshot_rows_email"), "identity_source_snapshot_rows", ["email"], unique=False)

    with op.batch_alter_table("org_members") as batch_op:
        batch_op.add_column(sa.Column("employee_id", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("identity_source_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("identity_snapshot_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("identity_status", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("identity_hash", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.create_unique_constraint("uq_org_members_employee_id", ["employee_id"])


def downgrade() -> None:
    with op.batch_alter_table("org_members") as batch_op:
        batch_op.drop_constraint("uq_org_members_employee_id", type_="unique")
        batch_op.drop_column("last_synced_at")
        batch_op.drop_column("identity_hash")
        batch_op.drop_column("identity_status")
        batch_op.drop_column("identity_snapshot_id")
        batch_op.drop_column("identity_source_id")
        batch_op.drop_column("employee_id")

    op.drop_index(op.f("ix_identity_source_snapshot_rows_email"), table_name="identity_source_snapshot_rows")
    op.drop_index(op.f("ix_identity_source_snapshot_rows_employee_id"), table_name="identity_source_snapshot_rows")
    op.drop_index(op.f("ix_identity_source_snapshot_rows_snapshot_id"), table_name="identity_source_snapshot_rows")
    op.drop_index(op.f("ix_identity_source_snapshot_rows_id"), table_name="identity_source_snapshot_rows")
    op.drop_table("identity_source_snapshot_rows")

    op.drop_index(op.f("ix_identity_source_snapshots_source_id"), table_name="identity_source_snapshots")
    op.drop_index(op.f("ix_identity_source_snapshots_id"), table_name="identity_source_snapshots")
    op.drop_table("identity_source_snapshots")

    op.drop_index(op.f("ix_identity_sources_id"), table_name="identity_sources")
    op.drop_table("identity_sources")
