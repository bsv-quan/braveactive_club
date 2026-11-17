"""Persist a shuffled display order for Wired headlines."""

from alembic import op
import sqlalchemy as sa

revision = "0010_wired_news_order"
down_revision = "0009_external_news"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "external_news",
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
    )
    op.execute(
        "DELETE FROM external_news WHERE category NOT IN ('Security', 'Politics', 'Big Story')"
    )
    op.execute(
        """
        WITH shuffled AS (
            SELECT url, ROW_NUMBER() OVER (ORDER BY RANDOM()) - 1 AS position
            FROM external_news
        )
        UPDATE external_news
        SET display_order = shuffled.position
        FROM shuffled
        WHERE external_news.url = shuffled.url
        """
    )


def downgrade() -> None:
    op.drop_column("external_news", "display_order")
