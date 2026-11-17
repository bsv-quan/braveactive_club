"""Add one-time email verification challenges.

Revision ID: 0005_email_verifications
Revises: 0004_notifications
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_email_verifications"
down_revision = "0004_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_verifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("display_name", sa.String(40), nullable=True),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", "purpose", name="uq_email_verifications_email_purpose"),
    )
    # Legacy reset links are no longer accepted.
    op.execute("DELETE FROM password_reset_tokens")


def downgrade() -> None:
    op.drop_table("email_verifications")
