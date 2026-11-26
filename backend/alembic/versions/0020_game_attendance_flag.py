"""Separate attendance from daily hint usage."""

from alembic import op
import sqlalchemy as sa

revision = "0020_game_attendance_flag"
down_revision = "0019_game_streak_hints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "game_daily_activities",
        sa.Column("attended", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("game_daily_activities", "attended")
