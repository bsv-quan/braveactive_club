"""Single-process WebSocket hub for community events, notices and presence."""

import asyncio
import contextlib
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger("app.realtime")

MAX_CONNECTIONS = 500


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[WebSocket, str | None] = {}
        self._session_hashes: dict[WebSocket, str | None] = {}

    @property
    def size(self) -> int:
        return len(self._connections)

    def can_accept(self) -> bool:
        return len(self._connections) < MAX_CONNECTIONS

    @property
    def online_user_ids(self) -> set[str]:
        return {user_id for user_id in self._connections.values() if user_id is not None}

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str | None = None,
        session_hash: str | None = None,
    ) -> None:
        await websocket.accept()
        was_online = user_id is not None and user_id in self.online_user_ids
        self._connections[websocket] = user_id
        self._session_hashes[websocket] = session_hash
        if user_id is not None and not was_online:
            await self.broadcast("presence.changed", userId=user_id, online=True)

    async def disconnect(self, websocket: WebSocket) -> None:
        user_id = self._connections.pop(websocket, None)
        self._session_hashes.pop(websocket, None)
        if user_id is not None and user_id not in self.online_user_ids:
            await self.broadcast("presence.changed", userId=user_id, online=False)

    async def invalidate_session(self, session_hash: str) -> None:
        """Close sockets authenticated with a session that has just been revoked."""
        sockets = [ws for ws, value in self._session_hashes.items() if value == session_hash]
        for websocket in sockets:
            with contextlib.suppress(Exception):
                await websocket.close(code=1008)
            await self.disconnect(websocket)

    async def send_to_user(self, user_id: str, event: dict[str, Any]) -> None:
        """Deliver a private event to every connected session for one user."""
        sockets = [ws for ws, connected_user in self._connections.items() if connected_user == user_id]
        results = await asyncio.gather(*(self._send(ws, event) for ws in sockets), return_exceptions=True)
        for ws, ok in zip(sockets, results):
            if ok is not True:
                await self.disconnect(ws)

    async def broadcast(self, event_type: str, **payload: Any) -> None:
        """Broadcast a system event to all feed subscribers."""
        await self.broadcast_event({"type": event_type, **payload})

    async def broadcast_event(self, event: dict[str, Any]) -> None:
        if not self._connections:
            return
        connections = list(self._connections)
        results = await asyncio.gather(*(self._send(ws, event) for ws in connections), return_exceptions=True)
        for ws, ok in zip(connections, results):
            if ok is not True:
                await self.disconnect(ws)

    @staticmethod
    async def _send(websocket: WebSocket, event: dict[str, Any]) -> bool:
        try:
            await asyncio.wait_for(websocket.send_json(event), timeout=5)
            return True
        except Exception:
            with contextlib.suppress(Exception):
                await websocket.close()
            return False


manager = ConnectionManager()


async def publish(event_type: str, **payload: Any) -> None:
    """Broadcast a typed event, e.g. ``publish("post.created", post=...)``."""
    await manager.broadcast_event({"type": event_type, **payload})


async def publish_to_user(user_id: str, event_type: str, **payload: Any) -> None:
    await manager.send_to_user(user_id, {"type": event_type, **payload})
