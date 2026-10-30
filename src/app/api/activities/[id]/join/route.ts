import { NextRequest, NextResponse } from "next/server";
import {
  activitiesKey,
  activityParticipantsKey,
  type ClubActivity,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để tham gia hoạt động." },
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
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    typeof body.name !== "string"
  ) {
    return NextResponse.json({ error: "Vui lòng nhập tên để tham gia." }, { status: 400 });
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) {
    return NextResponse.json(
      { error: "Tên cần từ 2 đến 40 ký tự." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const redis = getRedis();
  const activity = await redis.hget<ClubActivity>(activitiesKey, id);
  if (!activity) {
    return NextResponse.json({ error: "Không tìm thấy hoạt động." }, { status: 404 });
  }

  const memberKey = name.normalize("NFC").toLocaleLowerCase("vi");
  const joined = await redis.hsetnx(
    activityParticipantsKey(id),
    memberKey,
    name,
  );
  if (!joined) {
    return NextResponse.json(
      { error: "Tên này đã tham gia hoạt động rồi." },
      { status: 409 },
    );
  }

  return NextResponse.json({ name }, { status: 201 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xóa người tham gia." },
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
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    typeof body.name !== "string"
  ) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp tên người tham gia cần xóa." },
      { status: 400 },
    );
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 40) {
    return NextResponse.json(
      { error: "Tên người tham gia không hợp lệ." },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const redis = getRedis();
  const activity = await redis.hget<ClubActivity>(activitiesKey, id);
  if (!activity) {
    return NextResponse.json({ error: "Không tìm thấy hoạt động." }, { status: 404 });
  }

  const memberKey = name.normalize("NFC").toLocaleLowerCase("vi");
  const deleted = await redis.hdel(activityParticipantsKey(id), memberKey);
  if (!deleted) {
    return NextResponse.json(
      { error: "Không tìm thấy người tham gia cần xóa." },
      { status: 404 },
    );
  }

  return NextResponse.json({ name, deleted: true });
}
