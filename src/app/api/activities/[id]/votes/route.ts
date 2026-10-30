import { NextRequest, NextResponse } from "next/server";
import {
  activitiesKey,
  activityVotesKey,
  type ClubActivity,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để bình chọn ngày." },
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
    !("name" in body) ||
    !("dates" in body) ||
    typeof body.name !== "string" ||
    !Array.isArray(body.dates) ||
    !body.dates.every((date) => typeof date === "string")
  ) {
    return NextResponse.json(
      { error: "Vui lòng nhập tên và chọn ít nhất một ngày." },
      { status: 400 },
    );
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  const dates = [...new Set(body.dates as string[])];
  if (
    name.length < 2 ||
    name.length > 40 ||
    dates.length < 1 ||
    dates.length > 14 ||
    !dates.every(isValidDate)
  ) {
    return NextResponse.json(
      { error: "Tên hoặc ngày bình chọn không hợp lệ (chọn từ 1 đến 14 ngày)." },
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
  if (activity.scheduleType !== "poll") {
    return NextResponse.json(
      { error: "Hoạt động này đã có lịch cố định, không nhận bình chọn." },
      { status: 409 },
    );
  }

  const memberKey = name.normalize("NFC").toLocaleLowerCase("vi");
  await redis.hset(activityVotesKey(id), {
    [memberKey]: JSON.stringify({ name, dates }),
  });
  return NextResponse.json({ name, dates });
}
