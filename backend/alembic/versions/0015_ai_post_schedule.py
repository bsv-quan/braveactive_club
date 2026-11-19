"""Persist scheduled AI post execution state."""

from alembic import op
import sqlalchemy as sa

revision = "0015_ai_post_schedule"
down_revision = "0014_ai_posts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_post_schedule_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("slot_date", sa.Date(), nullable=False),
        sa.Column("slot_key", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("post_id", sa.Uuid(), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["post_id"], ["posts.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slot_date", "slot_key", name="uq_ai_post_schedule_slot_date_key"),
    )
    op.create_index(
        "ix_ai_post_schedule_runs_status_retry",
        "ai_post_schedule_runs",
        ["status", "next_attempt_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_post_schedule_runs_status_retry", table_name="ai_post_schedule_runs")
    op.drop_table("ai_post_schedule_runs")
