"""Require approval for member-created posts."""

from alembic import op
import sqlalchemy as sa

revision = "0012_post_moderation"
down_revision = "0011_activity_moderation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("approved", sa.Boolean(), server_default=sa.true(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("posts", "approved")
