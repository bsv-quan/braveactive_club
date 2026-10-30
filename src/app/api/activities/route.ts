import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  activitiesKey,
  activityParticipantsKey,
  isActivityCategory,
  type ClubActivity,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function GET() {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xem hoạt động." },
      { status: 503 },
    );
  }

  const redis = getRedis();
  const stored = await redis.hgetall<Record<string, ClubActivity>>(activitiesKey);
  const activities = await Promise.all(
    Object.values(stored ?? {}).map(async (activity) => {
      const participants = await redis.hgetall<Record<string, string>>(
        activityParticipantsKey(activity.id),
      );
      return {
        ...activity,
        createdAt: activity.createdAt ?? "1970-01-01T00:00:00.000Z",
        participants: Object.values(participants ?? {}),
      };
    }),
  );

  activities.sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để tạo hoạt động." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.title !== "string" ||
    typeof body.description !== "string" ||
    typeof body.category !== "string" ||
    typeof body.date !== "string" ||
    typeof body.creator !== "string"
  ) {
    return NextResponse.json(
      { error: "Vui lòng nhập tiêu đề, nội dung, loại, lịch và tên người tạo." },
      { status: 400 },
    );
  }

  const title = body.title.trim();
  const description = body.description.trim();
  const creator = body.creator.trim().replace(/\s+/g, " ");
  if (
    title.length < 3 ||
    title.length > 120 ||
    description.length < 5 ||
    description.length > 1000 ||
    creator.length < 2 ||
    creator.length > 40 ||
    !isActivityCategory(body.category) ||
    !validDate(body.date)
  ) {
    return NextResponse.json(
      { error: "Thông tin hoạt động chưa hợp lệ. Vui lòng kiểm tra lại các trường." },
      { status: 400 },
    );
  }

  const activity: ClubActivity = {
    id: randomUUID(),
    title,
    description,
    category: body.category,
    date: new Date(body.date).toISOString(),
    createdAt: new Date().toISOString(),
    creator,
    participants: [],
  };

  await getRedis().hset(activitiesKey, { [activity.id]: activity });
  return NextResponse.json({ activity }, { status: 201 });
}
