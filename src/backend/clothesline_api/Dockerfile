# Build context must be src/backend/ (not this directory), so the uv
# workspace can see the sibling clothesline_db package.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
WORKDIR /app
COPY . .
RUN uv sync --frozen --no-dev --package clothesline-api

FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/clothesline_api /app/clothesline_api
COPY --from=builder /app/clothesline_db /app/clothesline_db
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "clothesline_api.main:app"]
