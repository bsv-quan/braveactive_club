"""Add administrative account requests and post moderation state."""

from alembic import op
import sqlalchemy as sa

revision = "0006_admin_requests"
down_revision = "0005_email_verifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("display_name", sa.String(40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", "purpose", name="uq_account_requests_email_purpose"),
    )
    op.add_column("posts", sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.execute("DELETE FROM email_verifications")
    op.execute("DELETE FROM password_reset_tokens")


def downgrade() -> None:
    op.drop_column("posts", "hidden")
    op.drop_table("account_requests")
