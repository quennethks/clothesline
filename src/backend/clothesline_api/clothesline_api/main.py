import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import anyio
from clothesline_db.session import async_session_factory, create_db_engine
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from clothesline_api.auth.router import router as auth_router
from clothesline_api.config import settings
from clothesline_api.config_router import router as config_router
from clothesline_api.media import blob
from clothesline_api.media.router import router as media_router
from clothesline_api.sync.router import router as sync_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if settings.blob_connection_string:
        try:
            # Sync SDK call — off the event loop so a slow/unreachable Azurite
            # doesn't stall startup for every other route.
            await anyio.to_thread.run_sync(blob.ensure_container)
        except Exception:
            # Blob is only needed for photos; the counter flow (the core of
            # the app) must still come up if storage is misconfigured.
            logger.exception("could not prepare the blob container; photo uploads will fail")
    yield


app = FastAPI(title="Clothesline API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = create_db_engine(settings.database_url)
app.state.session_factory = async_session_factory(engine)

app.include_router(auth_router)
app.include_router(sync_router)
app.include_router(media_router)
app.include_router(config_router)


@app.get("/health")
async def health(response: Response) -> dict[str, str]:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        response.status_code = 503
        return {"status": "error", "db": "unreachable"}
    return {"status": "ok", "db": "ok"}
