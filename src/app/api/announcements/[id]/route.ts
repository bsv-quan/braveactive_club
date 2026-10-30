import { NextRequest, NextResponse } from "next/server";
import {
  activityAnnouncementsKey,
  type ClubAnnouncement,
} from "@/lib/content";
import { announcementCategories } from "../route";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function colorForCategory(category: string): ClubAnnouncement["color"] {
  if (category === "CẦU LÔNG") return "peach";
  if (category === "TỪ THIỆN") return "lavender";
  return "mint";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để sửa thông báo." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  if (
    !isRecord(body) ||
    typeof body.title !== "string" ||
    typeof body.description !== "string" ||
    typeof body.category !== "string"
  ) {
    return NextResponse.json(
      { error: "Vui lòng nhập tiêu đề, nội dung và loại thông báo." },
      { status: 400 },
    );
  }

  const title = body.title.trim();
  const description = body.description.trim();
  if (
    title.length < 3 ||
    title.length > 120 ||
    description.length < 5 ||
    description.length > 1000 ||
    !announcementCategories.includes(body.category)
  ) {
    return NextResponse.json(
      { error: "Thông tin thông báo chưa hợp lệ. Vui lòng kiểm tra lại." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const redis = getRedis();
  const current = await redis.hget<ClubAnnouncement>(
    activityAnnouncementsKey,
    id,
  );
  if (!current) {
    return NextResponse.json(
      { error: "Không tìm thấy thông báo cần sửa." },
      { status: 404 },
    );
  }

  const announcement: ClubAnnouncement = {
    ...current,
    title,
    description,
    category: body.category,
    color: colorForCategory(body.category),
  };
  await redis.hset(activityAnnouncementsKey, { [id]: announcement });
  return NextResponse.json({ announcement });
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xóa thông báo." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  if (id === "welcome") {
    return NextResponse.json(
      { error: "Không thể xóa thông báo chào mừng." },
      { status: 400 },
    );
  }

  const deleted = await getRedis().hdel(activityAnnouncementsKey, id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Không tìm thấy thông báo cần xóa." },
      { status: 404 },
    );
  }
  return NextResponse.json({ deleted: true });
}
