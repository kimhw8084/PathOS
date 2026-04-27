"""add company rollout tables

Revision ID: e1a9d7b44c20
Revises: c8d21f14aa32
Create Date: 2026-04-25 13:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e1a9d7b44c20"
down_revision = "c8d21f14aa32"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_configs",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("value", sa.JSON(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_app_configs_id"), "app_configs", ["id"], unique=False)
    op.create_index(op.f("ix_app_configs_key"), "app_configs", ["key"], unique=True)

    op.create_table(
        "org_members",
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("department", sa.String(), nullable=True),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("site", sa.String(), nullable=True),
        sa.Column("manager", sa.String(), nullable=True),
        sa.Column("roles", sa.JSON(), nullable=True),
        sa.Column("permissions", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("avatar_initials", sa.String(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_org_members_department"), "org_members", ["department"], unique=False)
    op.create_index(op.f("ix_org_members_email"), "org_members", ["email"], unique=True)
    op.create_index(op.f("ix_org_members_id"), "org_members", ["id"], unique=False)
    op.create_index(op.f("ix_org_members_full_name"), "org_members", ["full_name"], unique=False)
    op.create_index(op.f("ix_org_members_site"), "org_members", ["site"], unique=False)
    op.create_index(op.f("ix_org_members_team"), "org_members", ["team"], unique=False)

    op.create_table(
        "saved_views",
        sa.Column("entity_type", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("owner_email", sa.String(), nullable=False),
        sa.Column("scope", sa.String(), nullable=True),
        sa.Column("search_text", sa.String(), nullable=True),
        sa.Column("filters", sa.JSON(), nullable=True),
        sa.Column("active_ribbon", sa.String(), nullable=True),
        sa.Column("view_mode", sa.String(), nullable=True),
        sa.Column("shared_with_roles", sa.JSON(), nullable=True),
        sa.Column("shared_with_teams", sa.JSON(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_views_entity_type"), "saved_views", ["entity_type"], unique=False)
    op.create_index(op.f("ix_saved_views_id"), "saved_views", ["id"], unique=False)
    op.create_index(op.f("ix_saved_views_owner_email"), "saved_views", ["owner_email"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_views_owner_email"), table_name="saved_views")
    op.drop_index(op.f("ix_saved_views_id"), table_name="saved_views")
    op.drop_index(op.f("ix_saved_views_entity_type"), table_name="saved_views")
    op.drop_table("saved_views")

    op.drop_index(op.f("ix_org_members_team"), table_name="org_members")
    op.drop_index(op.f("ix_org_members_site"), table_name="org_members")
    op.drop_index(op.f("ix_org_members_full_name"), table_name="org_members")
    op.drop_index(op.f("ix_org_members_id"), table_name="org_members")
    op.drop_index(op.f("ix_org_members_email"), table_name="org_members")
    op.drop_index(op.f("ix_org_members_department"), table_name="org_members")
    op.drop_table("org_members")

    op.drop_index(op.f("ix_app_configs_key"), table_name="app_configs")
    op.drop_index(op.f("ix_app_configs_id"), table_name="app_configs")
    op.drop_table("app_configs")
