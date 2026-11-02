"""Announcements and static club content."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.permissions import can_manage
from app.models import Announcement, User
from app.schemas.club import AnnouncementBody, AnnouncementOut, ContentOut, PostSummaryOut

ANNOUNCEMENT_CATEGORIES = ("CẦU LÔNG", "TỪ THIỆN", "THỂ THAO", "CÂU LẠC BỘ")

WELCOME = AnnouncementOut(
    id="welcome",
    category="CÂU LẠC BỘ",
    title="Chào mừng bạn đến với Brave Active",
    description="Nơi kết nối những thành viên yêu vận động, sẻ chia và cùng nhau tạo nên những hoạt động ý nghĩa.",
    date="2026-10-28",
    color="mint",
)

CLUB_POSTS = [
    PostSummaryOut(
        id="badminton-beginners",
        category="CẦU LÔNG",
        title="Buổi giao lưu cầu lông cho mọi trình độ",
        description="Không cần là tay vợt chuyên nghiệp — chỉ cần bạn muốn chơi và gặp gỡ mọi người.",
        date="2026-10-26",
        read_time="3 phút đọc",
    ),
    PostSummaryOut(
        id="weekend-run",
        category="THỂ THAO",
        title="Cuối tuần năng động, bắt đầu từ một bước chân",
        description="Cùng các thành viên duy trì thói quen vận động và tiếp thêm năng lượng tích cực.",
        date="2026-10-23",
        read_time="2 phút đọc",
    ),
    PostSummaryOut(
        id="community-day",
        category="TỪ THIỆN",
        title="Một ngày sẻ chia cùng cộng đồng",
        description="Những hoạt động nhỏ sẽ trở nên ý nghĩa hơn khi chúng ta cùng góp sức.",
        date="2026-10-20",
        read_time="4 phút đọc",
    ),
]


def color_for_category(category: str) -> str:
    if category == "CẦU LÔNG":
        return "peach"
    if category == "TỪ THIỆN":
        return "lavender"
    return "mint"


def to_out(item: Announcement) -> AnnouncementOut:
    return AnnouncementOut(
        id=str(item.id),
        category=item.category,
        title=item.title,
        description=item.description,
        date=item.created_at.date().isoformat(),
        color=item.color,
    )


def validate_body(body: AnnouncementBody) -> tuple[str, str, str]:
    title, description = body.title.strip(), body.description.strip()
    if (
        not 3 <= len(title) <= 120
        or not 5 <= len(description) <= 1000
        or body.category not in ANNOUNCEMENT_CATEGORIES
    ):
        raise AppError("Thông tin thông báo chưa hợp lệ. Vui lòng kiểm tra lại.", 400)
    return title, description, body.category


async def get_content(db: AsyncSession) -> ContentOut:
    rows = (await db.scalars(select(Announcement).order_by(Announcement.created_at.desc()))).all()
    return ContentOut(announcements=[WELCOME, *(to_out(row) for row in rows)], posts=CLUB_POSTS)


async def _get_or_404(db: AsyncSession, announcement_id: str) -> Announcement:
    try:
        item = await db.get(Announcement, uuid.UUID(announcement_id))
    except ValueError:
        item = None
    if not item:
        raise AppError("Không tìm thấy thông báo.", 404)
    return item


async def create_announcement(db: AsyncSession, user: User, body: AnnouncementBody) -> AnnouncementOut:
    title, description, category = validate_body(body)
    item = Announcement(
        title=title, description=description, category=category, color=color_for_category(category), created_by=user.id
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return to_out(item)


async def update_announcement(db: AsyncSession, user: User, announcement_id: str, body: AnnouncementBody) -> AnnouncementOut:
    title, description, category = validate_body(body)
    item = await _get_or_404(db, announcement_id)
    if not can_manage(user, item.created_by):
        raise AppError("Bạn không có quyền sửa thông báo này.", 403)
    item.title, item.description, item.category = title, description, category
    item.color = color_for_category(category)
    await db.commit()
    return to_out(item)


async def delete_announcement(db: AsyncSession, user: User, announcement_id: str) -> None:
    if announcement_id == "welcome":
        raise AppError("Không thể xóa thông báo chào mừng.", 400)
    item = await _get_or_404(db, announcement_id)
    if not can_manage(user, item.created_by):
        raise AppError("Bạn không có quyền xóa thông báo này.", 403)
    await db.delete(item)
    await db.commit()
