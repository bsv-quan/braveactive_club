import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  activitiesKey,
  activityCommentsKey,
  type ActivityComment,
  type ClubActivity,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để gửi bình luận." },
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
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string"
  ) {
    return NextResponse.json(
      { error: "Vui lòng nhập nội dung bình luận." },
      { status: 400 },
    );
  }

  const message = body.message.trim();
  if (message.length < 2 || message.length > 1000) {
    return NextResponse.json(
      { error: "Nội dung bình luận cần từ 2 đến 1000 ký tự." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const redis = getRedis();
  const activity = await redis.hget<ClubActivity>(activitiesKey, id);
  if (!activity) {
    return NextResponse.json(
      { error: "Không tìm thấy hoạt động." },
      { status: 404 },
    );
  }

  const comment: ActivityComment = {
    id: randomUUID(),
    message,
    createdAt: new Date().toISOString(),
  };
  await redis.hset(activityCommentsKey(id), {
    [comment.id]: comment,
  });

  return NextResponse.json({ comment }, { status: 201 });
}
