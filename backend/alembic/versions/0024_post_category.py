"""Add post category and AI category check marker, seeding known source hints."""

from alembic import op
import sqlalchemy as sa

revision = "0024_post_category"
down_revision = "0023_slack_management"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("category", sa.String(length=32), nullable=True))
    op.add_column("posts", sa.Column("category_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_posts_category_created_at_id", "posts", ["category", "created_at", "id"])

    # Seed initial categories from known RSS/activity source metadata while keeping
    # category_checked_at NULL so the AI backfill agent scans every existing post.
    op.execute(
        """
        UPDATE posts
        SET category = CASE
            WHEN content LIKE '%Loại hoạt động: CẦU LÔNG%'
              OR content LIKE '%Loại hoạt động: THỂ THAO%'
              OR COALESCE(link_url, '') ILIKE '%/the-thao%'
              OR COALESCE(link_site, '') ILIKE '%espn.com%'
              OR COALESCE(link_site, '') ILIKE '%olympics.com%'
            THEN 'sports'
            WHEN content LIKE '%Loại hoạt động: GIẢI TRÍ%'
              OR COALESCE(link_url, '') ILIKE '%/giai-tri%'
              OR COALESCE(link_url, '') ILIKE '%/thu-gian%'
            THEN 'entertainment'
            WHEN content LIKE '%Loại hoạt động: TỪ THIỆN%'
              OR COALESCE(link_url, '') ILIKE '%/thoi-su%'
              OR COALESCE(link_url, '') ILIKE '%/xa-hoi%'
              OR COALESCE(link_url, '') ILIKE '%/giao-duc%'
              OR COALESCE(link_url, '') ILIKE '%/phap-luat%'
            THEN 'society'
            WHEN COALESCE(link_url, '') ILIKE '%/van-hoa%'
              OR COALESCE(link_url, '') ILIKE '%/nghe-thuat%'
            THEN 'culture'
            WHEN COALESCE(link_url, '') ILIKE '%/khoa-hoc-cong-nghe%'
              OR COALESCE(link_url, '') ILIKE '%/cong-nghe%'
              OR COALESCE(link_url, '') ILIKE '%/so-hoa%'
              OR COALESCE(link_site, '') ILIKE '%techcrunch.com%'
              OR COALESCE(link_site, '') ILIKE '%venturebeat.com%'
              OR COALESCE(link_site, '') ILIKE '%openai.com%'
              OR COALESCE(link_site, '') ILIKE '%blog.google%'
              OR COALESCE(link_site, '') ILIKE '%genk.vn%'
              OR COALESCE(link_site, '') ILIKE '%arstechnica.com%'
              OR COALESCE(link_site, '') ILIKE '%wired.com%'
              OR COALESCE(link_site, '') ILIKE '%technologyreview.com%'
              OR COALESCE(link_site, '') ILIKE '%theregister.com%'
              OR COALESCE(link_site, '') ILIKE '%ieee.org%'
              OR COALESCE(link_site, '') ILIKE '%cisa.gov%'
            THEN 'technology'
            WHEN COALESCE(link_url, '') ILIKE '%/suc-khoe%'
              OR COALESCE(link_url, '') ILIKE '%/du-lich%'
              OR COALESCE(link_url, '') ILIKE '%/doi-song%'
              OR COALESCE(link_url, '') ILIKE '%/gia-dinh%'
              OR COALESCE(link_site, '') ILIKE '%who.int%'
              OR COALESCE(link_site, '') ILIKE '%nih.gov%'
              OR COALESCE(link_site, '') ILIKE '%cdc.gov%'
              OR COALESCE(link_site, '') ILIKE '%nhs.uk%'
              OR COALESCE(link_site, '') ILIKE '%mayoclinic.org%'
              OR COALESCE(link_site, '') ILIKE '%health.harvard.edu%'
              OR COALESCE(link_site, '') ILIKE '%suckhoedoisong.vn%'
              OR COALESCE(link_site, '') ILIKE '%lonelyplanet.com%'
              OR COALESCE(link_site, '') ILIKE '%nationalgeographic.com%'
            THEN 'lifestyle'
            ELSE NULL
        END
        WHERE category IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_posts_category_created_at_id", table_name="posts")
    op.drop_column("posts", "category_checked_at")
    op.drop_column("posts", "category")
