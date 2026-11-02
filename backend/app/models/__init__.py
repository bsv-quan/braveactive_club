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
from app.models.community import Post, PostComment, PostLike  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.user import PasswordResetToken, User, UserSession  # noqa: F401
