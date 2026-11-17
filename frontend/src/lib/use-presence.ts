"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { communityApi } from "@/lib/api/community";
import { useAuth } from "@/components/auth/auth-provider";
import { useFeedEvents } from "@/lib/use-feed-events";

/** Loads current status in one batch and keeps it synchronized through the shared WebSocket. */
export function usePresence(userIds: string[]) {
  const { user } = useAuth();
  const idsKey = useMemo(() => [...new Set(userIds)].sort().join(","), [userIds]);
  const ids = useMemo(() => idsKey ? idsKey.split(",") : [], [idsKey]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());
  const [knownIds, setKnownIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!ids.length) return;
    try {
      const result = await communityApi.getPresence(ids);
      setOnlineIds(new Set(result.onlineUserIds));
      setKnownIds(new Set(ids));
    } catch {
      setKnownIds(new Set());
    }
  }, [ids]);

  useEffect(() => {
    if (!ids.length) {
      setOnlineIds(new Set());
      setKnownIds(new Set());
      return;
    }

    void refresh();
  }, [ids.length, idsKey, refresh]);

  useFeedEvents((event) => {
    if (event.type !== "presence.changed") return;
    setKnownIds((current) => new Set(current).add(event.userId));
    setOnlineIds((current) => {
      const next = new Set(current);
      if (event.online) next.add(event.userId);
      else next.delete(event.userId);
      return next;
    });
  }, refresh, Boolean(user && !user.mustChangePassword));

  return useMemo(
    () => ({
      onlineIds,
      statusFor: (userId: string): boolean | undefined =>
        knownIds.has(userId) ? onlineIds.has(userId) : undefined,
    }),
    [knownIds, onlineIds],
  );
}
