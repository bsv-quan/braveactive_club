"""Persist AI-detected activity locations for map display."""

from alembic import op
import sqlalchemy as sa

revision = "0016_activity_location"
down_revision = "0015_ai_post_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("location", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "location")
