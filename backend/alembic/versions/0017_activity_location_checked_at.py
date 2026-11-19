"""Track one-time AI location checks for activities."""

from alembic import op
import sqlalchemy as sa

revision = "0017_activity_loc_checked"
down_revision = "0016_activity_location"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("location_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE activities SET location_checked_at = now() WHERE location IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("activities", "location_checked_at")
