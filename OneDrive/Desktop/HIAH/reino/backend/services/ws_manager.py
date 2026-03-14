"""
Reino - WebSocket Manager
Real-time bidirectional events per user
"""
import json
import logging
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # user_id → list of WebSocket connections (multi-device support)
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        self._connections.setdefault(user_id, []).append(ws)
        logger.info(f"[WS] {user_id} connected ({len(self._connections[user_id])} devices)")
        await self._send(ws, {"type": "connected", "payload": {"message": "Hiah is online"}})

    def disconnect(self, ws: WebSocket, user_id: str):
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, data: dict):
        """Send event to all devices of a user."""
        conns = self._connections.get(user_id, [])
        dead = []
        msg = json.dumps({**data, "ts": datetime.utcnow().isoformat()})
        for ws in conns:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast_all(self, data: dict):
        """Broadcast to every connected user (system events)."""
        for user_id in list(self._connections.keys()):
            await self.send_to_user(user_id, data)

    async def _send(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps({**data, "ts": datetime.utcnow().isoformat()}))
        except Exception as e:
            logger.error(f"[WS] send error: {e}")

    # ── Typed helpers ──────────────────────────────────────────
    async def notify_new_message(self, user_id: str, msg: dict):
        await self.send_to_user(user_id, {"type": "new_message", "payload": msg})

    async def notify_call_update(self, user_id: str, call: dict):
        await self.send_to_user(user_id, {"type": "call_update", "payload": call})

    async def notify_hiah_action(self, user_id: str, action: dict):
        await self.send_to_user(user_id, {"type": "hiah_action", "payload": action})

    async def notify_sync(self, user_id: str, summary: dict):
        await self.send_to_user(user_id, {"type": "sync_complete", "payload": summary})


ws_manager = ConnectionManager()
