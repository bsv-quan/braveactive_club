"""Add persistent Slack notification schedules."""

from alembic import op
import sqlalchemy as sa

revision = "0022_activity_slack_schedules"
down_revision = "0021_activity_edit_pending"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_slack_schedules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("activity_id", sa.Uuid(), sa.ForeignKey("activities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("interval", sa.String(16), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("send_time", sa.Time(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=True),
        sa.Column("month_day", sa.Integer(), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(200), nullable=True),
    )
    op.create_index("ix_activity_slack_schedules_activity_id", "activity_slack_schedules", ["activity_id"])
    op.create_index("ix_activity_slack_schedules_next_attempt", "activity_slack_schedules", ["next_attempt_at"])


def downgrade() -> None:
    op.drop_table("activity_slack_schedules")
