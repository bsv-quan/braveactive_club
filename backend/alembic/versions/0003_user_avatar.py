"""Add profile avatar storage.

Revision ID: 0003_user_avatar
Revises: 0002_must_change_password
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_user_avatar"
down_revision = "0002_must_change_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_name", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_name")
