import { NextResponse } from "next/server";
import { activitiesKey, activityParticipantsKey } from "@/lib/activities";
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
  const deleted = await redis.hdel(activitiesKey, id);
  if (!deleted) {
    return NextResponse.json({ error: "Không tìm thấy hoạt động." }, { status: 404 });
  }

  await redis.del(activityParticipantsKey(id));
  return NextResponse.json({ deleted: true });
}
