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
from app.models.community import Feedback, Post, PostComment, PostLike  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.external_news import ExternalNews  # noqa: F401
from app.models.user import AccountRequest, EmailVerification, PasswordResetToken, User, UserSession  # noqa: F401
