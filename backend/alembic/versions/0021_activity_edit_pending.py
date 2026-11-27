"""Track activity edits awaiting moderation."""

from alembic import op
import sqlalchemy as sa

revision = "0021_activity_edit_pending"
down_revision = "0020_game_attendance_flag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("edit_pending", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("activities", "edit_pending")
