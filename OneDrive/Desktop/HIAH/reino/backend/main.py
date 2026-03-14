"""
Reino Daily Task Assistant — Backend v2.2
"""
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import settings
from models import init_db
from services.ws_manager import ws_manager
from services.auth import decode_token
from routers.auth          import router as auth_router
from routers.contacts      import router as contacts_router
from routers.calls         import router as calls_router
from routers.messages      import router as messages_router
from routers.hiah          import router as hiah_router
from routers.settings      import router as settings_router
from routers.notifications import router as notif_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("reino")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Reino v2.2 starting…")
    await init_db(settings.mongodb_url, settings.mongodb_db)
    logger.info(f"✅ MongoDB: {settings.mongodb_db}")
    logger.info(f"   Gemini: {'✅' if settings.gemini_api_key else '❌ (users can set in Settings)'}")
    logger.info(f"   ElevenLabs: {'✅' if settings.elevenlabs_api_key else '❌ (users can set in Settings)'}")
    logger.info("   Hiah is online 💜")
    yield
    logger.info("Reino shutting down…")


app = FastAPI(
    title="Reino Daily Task Assistant",
    version="2.2.0",
    description="AI-powered communications platform — Hiah Agent",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in [auth_router, contacts_router, calls_router, messages_router,
          hiah_router, settings_router, notif_router]:
    app.include_router(r)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket, user_id)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                event = json.loads(raw)
                etype = event.get("type", "")

                if etype == "ping":
                    await ws_manager.send_to_user(user_id, {"type": "pong"})

                elif etype == "call_update":
                    from models import CallRecord
                    cid = event.get("call_id")
                    if cid:
                        c = await CallRecord.find_one(CallRecord.id == cid, CallRecord.user_id == user_id)
                        if c:
                            for k, v in event.get("data", {}).items():
                                if hasattr(c, k): setattr(c, k, v)
                            await c.save()
                            await ws_manager.notify_call_update(user_id, {"event": "call_updated", "call": event.get("data", {})})

                elif etype == "message_status":
                    from models import Message
                    mid = event.get("message_id")
                    status = event.get("status")
                    if mid and status:
                        m = await Message.find_one(Message.id == mid, Message.user_id == user_id)
                        if m:
                            m.status = status
                            await m.save()

                elif etype == "incoming_call":
                    # Device reports an incoming call
                    from routers.calls import register_incoming
                    # This is handled via the REST endpoint instead

                elif etype == "sim_cards":
                    # Device reports its SIM cards
                    from models import User, SimCard
                    user = await User.find_one(User.id == user_id)
                    if user:
                        sims_data = event.get("sims", [])
                        user.sim_cards = [SimCard(**s) for s in sims_data]
                        await user.save()
                        await ws_manager.send_to_user(user_id, {"type": "sim_cards_updated", "payload": sims_data})

            except Exception as e:
                logger.error(f"[WS] event error: {e}")

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "version": "2.2.0",
        "hiah": "online",
        "gemini": bool(settings.gemini_api_key),
        "elevenlabs": bool(settings.elevenlabs_api_key),
        "ws_connections": sum(len(v) for v in ws_manager._connections.values()),
    }


# Serve built PWA
dist = Path(__file__).parent.parent / "frontend" / "dist"
if dist.exists():
    app.mount("/assets", StaticFiles(directory=str(dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        return FileResponse(str(dist / "index.html"))
else:
    @app.get("/", include_in_schema=False)
    async def root():
        return {"message": "Reino API v2.2 running", "docs": "/docs", "health": "/api/health"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.app_host, port=settings.app_port, reload=settings.debug)
