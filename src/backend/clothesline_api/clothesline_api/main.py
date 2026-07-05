from clothesline_db.session import async_session_factory, create_db_engine
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from clothesline_api.auth.router import router as auth_router
from clothesline_api.config import settings

app = FastAPI(title="Clothesline API")

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


@app.get("/health")
async def health(response: Response) -> dict[str, str]:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        response.status_code = 503
        return {"status": "error", "db": "unreachable"}
    return {"status": "ok", "db": "ok"}
