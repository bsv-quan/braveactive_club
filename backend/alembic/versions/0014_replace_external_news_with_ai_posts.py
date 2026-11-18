"""Remove the obsolete external news cache used by the Wired crawler."""

from alembic import op
import sqlalchemy as sa

revision = "0014_ai_posts"
down_revision = "0013_feedback"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_external_news_category_published_at", table_name="external_news")
    op.drop_index("ix_external_news_published_at", table_name="external_news")
    op.drop_table("external_news")


def downgrade() -> None:
    op.create_table(
        "external_news",
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.PrimaryKeyConstraint("url"),
    )
    op.create_index("ix_external_news_published_at", "external_news", ["published_at"])
    op.create_index(
        "ix_external_news_category_published_at",
        "external_news",
        ["category", "published_at"],
    )
