import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.domain.common import PushValidationError
from clothesline_api.sync.registry import REGISTRY, SyncCollection
from clothesline_api.sync.schemas import row_to_wire

# A sentinel distinguishing "applied cleanly, no conflict" from "conflict,
# and the conflicting master doc happens to be None" (a rejected create has
# no existing row, so its conflict doc IS legitimately None) — returning
# plain None for both would make handle_push drop the second case silently.
_APPLIED = object()


async def handle_push(
    session: AsyncSession,
    collection_name: str,
    user_id: uuid.UUID,
    rows: list[dict[str, Any]],
) -> list[dict[str, Any] | None]:
    collection = REGISTRY.get(collection_name)
    if collection is None:
        raise HTTPException(status_code=404, detail=f"unknown collection: {collection_name}")

    conflicts: list[dict[str, Any] | None] = []
    for row in rows:
        result = await _apply_one(
            session, collection, user_id, row["new_document_state"], row.get("assumed_master_state")
        )
        if result is not _APPLIED:
            conflicts.append(result)  # type: ignore[arg-type]

    await session.commit()
    return conflicts


async def _apply_one(
    session: AsyncSession,
    collection: SyncCollection,
    user_id: uuid.UUID,
    new_state: dict[str, Any],
    assumed_master_state: dict[str, Any] | None,
) -> dict[str, Any] | None | object:
    doc_id = uuid.UUID(new_state["id"])
    existing = await session.get(collection.model, doc_id)

    # Idempotent upsert-by-id (spec §5.2): if the server's current state
    # doesn't match what the client assumed, don't apply — return the
    # current master doc as a conflict so RxDB resolves it on the client.
    current_wire = row_to_wire(existing, collection.fields) if existing is not None else None
    if current_wire != assumed_master_state:
        return current_wire

    def _identity(value: object) -> object:
        return value

    incoming_fields = {
        field_name: collection.parsers.get(field_name, _identity)(new_state.get(field_name))
        for field_name in collection.fields
        if field_name in new_state
    }

    try:
        await collection.validator.validate(session, user_id, existing, incoming_fields)  # type: ignore[attr-defined]
    except PushValidationError:
        # Invariant violation -> conflict, not a 4xx: the illegal write is
        # reverted on the client's next merge (spec §5.1/§5.2). For a
        # rejected create, current_wire is None — that's still a conflict
        # entry (see _APPLIED above), not "nothing happened."
        return current_wire

    deleted = bool(new_state.get("_deleted", False))

    if existing is None:
        instance = collection.model(id=doc_id, **incoming_fields)  # type: ignore[call-arg]
        if deleted:
            instance.deleted_at = datetime.now(UTC)
        session.add(instance)
    else:
        for field_name, value in incoming_fields.items():
            setattr(existing, field_name, value)
        if deleted:
            existing.deleted_at = existing.deleted_at or datetime.now(UTC)
        else:
            existing.deleted_at = None

    await session.flush()
    return _APPLIED
