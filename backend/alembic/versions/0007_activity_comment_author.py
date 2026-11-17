"""Store the account display name on activity-space comments."""

from alembic import op
import sqlalchemy as sa

revision = "0007_activity_comment_author"
down_revision = "0006_admin_requests"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activity_comments", sa.Column("author_name", sa.String(length=40), nullable=True))


def downgrade() -> None:
    op.drop_column("activity_comments", "author_name")
