"use client";

import { useEffect, useRef } from "react";
import type { FeedEvent } from "@/lib/api/community";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/feed";
const PING_INTERVAL_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

type Subscriber = { onEvent: (event: FeedEvent) => void; onReconnect?: () => void };
const subscribers = new Set<Subscriber>();
let socket: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let attempts = 0;
let generation = 0;

function connect() {
  if (subscribers.size === 0 || (socket && socket.readyState < WebSocket.CLOSING)) return;
  const currentGeneration = ++generation;
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    if (generation !== currentGeneration) return;
    const wasRetry = attempts > 0;
    attempts = 0;
    if (wasRetry) subscribers.forEach(({ onReconnect }) => onReconnect?.());
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) socket.send("ping");
    }, PING_INTERVAL_MS);
  };

  socket.onmessage = (message) => {
    if (generation !== currentGeneration || message.data === "pong") return;
    try {
      const event = JSON.parse(message.data as string) as FeedEvent;
      subscribers.forEach(({ onEvent }) => onEvent(event));
    } catch {
      // Ignore malformed frames from an outdated or invalid server.
    }
  };

  socket.onclose = () => {
    if (generation !== currentGeneration) return;
    clearInterval(pingTimer);
    socket = null;
    if (subscribers.size === 0) return;
    const delay = Math.min(1000 * 2 ** attempts, MAX_BACKOFF_MS);
    attempts += 1;
    retryTimer = setTimeout(connect, delay);
  };
}

function subscribe(subscriber: Subscriber) {
  subscribers.add(subscriber);
  if (!socket || socket.readyState >= WebSocket.CLOSING) connect();
  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) {
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      attempts = 0;
      generation += 1;
      const closingSocket = socket;
      socket = null;
      closingSocket?.close();
    }
  };
}

/** Multiple consumers share one WebSocket connection. */
export function useFeedEvents(onEvent: (event: FeedEvent) => void, onReconnect?: () => void, enabled = true) {
  const eventRef = useRef(onEvent);
  const reconnectRef = useRef(onReconnect);
  useEffect(() => {
    eventRef.current = onEvent;
    reconnectRef.current = onReconnect;
  });

  useEffect(() => {
    if (!enabled) return;
    const subscriber = {
      onEvent: (event: FeedEvent) => eventRef.current(event),
      onReconnect: () => reconnectRef.current?.(),
    };
    return subscribe(subscriber);
  }, [enabled]);
}
