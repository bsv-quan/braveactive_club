"""Track game streaks and daily free hints."""

from alembic import op
import sqlalchemy as sa

revision = "0019_game_streak_hints"
down_revision = "0018_game_round_scores"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "game_daily_activities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("free_hints_used", sa.Integer(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "activity_date", name="uq_game_daily_activity_user_date"),
    )
    op.create_index(
        "ix_game_daily_activity_user_date",
        "game_daily_activities",
        ["user_id", "activity_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_game_daily_activity_user_date", table_name="game_daily_activities")
    op.drop_table("game_daily_activities")
