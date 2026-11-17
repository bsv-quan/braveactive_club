"""Add approval status for member-created activities."""

from alembic import op
import sqlalchemy as sa

revision = "0011_activity_moderation"
down_revision = "0010_wired_news_order"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "activities",
        sa.Column("approved", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "activities",
        sa.Column("share_to_community", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("activities", "share_to_community")
    op.drop_column("activities", "approved")
