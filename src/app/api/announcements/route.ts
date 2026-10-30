import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { activityAnnouncementsKey, type ClubAnnouncement } from "@/lib/content";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

export const announcementCategories = [
  "CẦU LÔNG",
  "TỪ THIỆN",
  "THỂ THAO",
  "CÂU LẠC BỘ",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function colorForCategory(category: string): ClubAnnouncement["color"] {
  if (category === "CẦU LÔNG") return "peach";
  if (category === "TỪ THIỆN") return "lavender";
  return "mint";
}

export async function POST(request: NextRequest) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để tạo thông báo." },
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

  const announcement: ClubAnnouncement = {
    id: randomUUID(),
    category: body.category,
    title,
    description,
    date: new Date().toISOString().slice(0, 10),
    color: colorForCategory(body.category),
  };

  await getRedis().hset(activityAnnouncementsKey, {
    [announcement.id]: announcement,
  });
  return NextResponse.json({ announcement }, { status: 201 });
}
