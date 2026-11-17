"""Support multiple images on community posts."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_post_images"
down_revision = "0007_activity_comment_author"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column(
            "image_names",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.execute(
        "UPDATE posts SET image_names = jsonb_build_array(image_name) "
        "WHERE image_name IS NOT NULL AND image_names = '[]'::jsonb"
    )


def downgrade() -> None:
    op.drop_column("posts", "image_names")
