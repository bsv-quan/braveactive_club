"""Store cached external news metadata."""

from alembic import op
import sqlalchemy as sa

revision = "0009_external_news"
down_revision = "0008_post_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_news",
        sa.Column("url", sa.String(length=2048), primary_key=True),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_external_news_published_at", "external_news", ["published_at"])
    op.create_index(
        "ix_external_news_category_published_at",
        "external_news",
        ["category", "published_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_external_news_category_published_at", table_name="external_news")
    op.drop_index("ix_external_news_published_at", table_name="external_news")
    op.drop_table("external_news")
