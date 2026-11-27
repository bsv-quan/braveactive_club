"""Preserve Slack schedules and record delivery attempts."""

from alembic import op
import sqlalchemy as sa

revision = "0023_slack_management"
down_revision = "0022_activity_slack_schedules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activity_slack_schedules", sa.Column("activity_title", sa.String(120), nullable=True))
    op.execute("UPDATE activity_slack_schedules s SET activity_title = a.title FROM activities a WHERE a.id = s.activity_id")
    op.alter_column("activity_slack_schedules", "activity_title", nullable=False)
    op.add_column("activity_slack_schedules", sa.Column("paused", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("activity_slack_schedules", sa.Column("cancelled", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.drop_constraint("activity_slack_schedules_activity_id_fkey", "activity_slack_schedules", type_="foreignkey")
    op.alter_column("activity_slack_schedules", "activity_id", nullable=True)
    op.create_foreign_key("activity_slack_schedules_activity_id_fkey", "activity_slack_schedules", "activities", ["activity_id"], ["id"], ondelete="SET NULL")
    op.create_table(
        "activity_slack_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("schedule_id", sa.Uuid(), sa.ForeignKey("activity_slack_schedules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("error", sa.String(200), nullable=True),
    )
    op.create_index("ix_activity_slack_deliveries_schedule_time", "activity_slack_deliveries", ["schedule_id", "attempted_at", "id"])


def downgrade() -> None:
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM activity_slack_schedules WHERE activity_id IS NULL OR cancelled) OR EXISTS (SELECT 1 FROM activity_slack_deliveries) THEN RAISE EXCEPTION 'Cannot downgrade: Slack history or archived schedules would be lost'; END IF; END $$")
    op.drop_table("activity_slack_deliveries")
    op.drop_constraint("activity_slack_schedules_activity_id_fkey", "activity_slack_schedules", type_="foreignkey")
    op.alter_column("activity_slack_schedules", "activity_id", nullable=False)
    op.create_foreign_key("activity_slack_schedules_activity_id_fkey", "activity_slack_schedules", "activities", ["activity_id"], ["id"], ondelete="CASCADE")
    op.drop_column("activity_slack_schedules", "cancelled")
    op.drop_column("activity_slack_schedules", "paused")
    op.drop_column("activity_slack_schedules", "activity_title")
