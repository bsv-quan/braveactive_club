import { NextResponse } from "next/server";
import {
  activityDay,
  activityCommentsKey,
  activitiesKey,
  activityNameDayKey,
  activityParticipantsKey,
  activityVotesKey,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xóa hoạt động." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const redis = getRedis();
  const activity = await redis.hget<{ date: string | null; day?: string | null; title: string }>(
    activitiesKey,
    id,
  );
  if (!activity) {
    return NextResponse.json({ error: "Không tìm thấy hoạt động." }, { status: 404 });
  }
  const deleted = await redis.hdel(activitiesKey, id);
  if (!deleted) {
    return NextResponse.json({ error: "Không tìm thấy hoạt động." }, { status: 404 });
  }

  const day = activityDay(activity);
  const keysToDelete = [
    activityParticipantsKey(id),
    activityVotesKey(id),
    activityCommentsKey(id),
    ...(day ? [activityNameDayKey(day, activity.title)] : []),
  ];
  await redis.del(...keysToDelete);
  return NextResponse.json({ deleted: true });
}
