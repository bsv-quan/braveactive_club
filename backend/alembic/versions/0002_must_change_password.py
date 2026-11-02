"""Track accounts that need to replace a temporary password.

Revision ID: 0002_must_change_password
Revises: 0001_initial_schema
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_must_change_password"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "must_change_password")
