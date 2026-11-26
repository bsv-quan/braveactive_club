"""Persist member scores for entertainment game rounds."""

from alembic import op
import sqlalchemy as sa

revision = "0018_game_round_scores"
down_revision = "0017_activity_loc_checked"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "game_rounds",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("game_type", sa.String(length=32), nullable=False),
        sa.Column("state", sa.Text(), nullable=False),
        sa.Column("score", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_game_rounds_user_id", "game_rounds", ["user_id"])
    op.create_index("ix_game_rounds_created_score", "game_rounds", ["created_at", "score"])
    op.create_index("ix_game_rounds_user_created", "game_rounds", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_game_rounds_user_created", table_name="game_rounds")
    op.drop_index("ix_game_rounds_created_score", table_name="game_rounds")
    op.drop_index("ix_game_rounds_user_id", table_name="game_rounds")
    op.drop_table("game_rounds")
