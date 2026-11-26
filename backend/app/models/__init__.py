"""Import every model so Alembic and ``Base.metadata`` see all tables."""

from app.models.club import (  # noqa: F401
    Activity,
    ActivityComment,
    ActivityParticipant,
    ActivityRecurrence,
    ActivityVote,
    Announcement,
    BadmintonRegistration,
)
from app.models.ai_schedule import AIPostScheduleRun  # noqa: F401
from app.models.game_score import GameDailyActivity, GameRound  # noqa: F401
from app.models.community import Feedback, Post, PostComment, PostLike  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.user import AccountRequest, EmailVerification, PasswordResetToken, User, UserSession  # noqa: F401
