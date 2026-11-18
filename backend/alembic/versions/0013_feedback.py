"""Add user feedback submissions."""

from alembic import op
import sqlalchemy as sa

revision = "0013_feedback"
down_revision = "0012_post_moderation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("author_id", sa.Uuid(), nullable=True),
        sa.Column("author_name", sa.String(length=40), nullable=True),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_feedback_author_id", "feedback", ["author_id"])
    op.create_index("ix_feedback_created_at_id", "feedback", ["created_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_feedback_created_at_id", table_name="feedback")
    op.drop_index("ix_feedback_author_id", table_name="feedback")
    op.drop_table("feedback")
