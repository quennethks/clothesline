import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from clothesline_api.sync.registry import SyncCollection
from clothesline_api.sync.schemas import iso_z, row_to_wire

_EPOCH = "1970-01-01T00:00:00.000Z"


async def handle_pull(
    session: AsyncSession,
    collection: SyncCollection,
    user_id: uuid.UUID,
    checkpoint_id: str | None,
    checkpoint_updated_at: str | None,
    batch_size: int,
) -> dict[str, Any]:
    model = collection.model
    stmt = collection.owner_filter(select(model), user_id)

    # The wire format truncates to milliseconds (spec §4's ISO 8601 "[.sss]"
    # convention), but Postgres timestamps carry microsecond precision — if
    # the checkpoint were compared against the raw column, a row whose true
    # value rounds *up* on the wire would look newer than the checkpoint
    # derived from that same rounded string and reappear on the next page.
    # Truncating the column to milliseconds before comparing keeps the
    # checkpoint round-trip exact.
    ordering_key = func.date_trunc("milliseconds", model.updated_at)

    if checkpoint_updated_at is not None:
        checkpoint_dt = datetime.fromisoformat(checkpoint_updated_at.replace("Z", "+00:00"))
        if checkpoint_id is not None:
            checkpoint_uuid = uuid.UUID(checkpoint_id)
            stmt = stmt.where(
                or_(
                    ordering_key > checkpoint_dt,
                    and_(ordering_key == checkpoint_dt, model.id > checkpoint_uuid),
                )
            )
        else:
            stmt = stmt.where(ordering_key > checkpoint_dt)

    stmt = stmt.order_by(ordering_key.asc(), model.id.asc()).limit(batch_size)

    result = await session.execute(stmt)
    rows = result.scalars().all()

    documents = [row_to_wire(row, collection.fields) for row in rows]
    if rows:
        last = rows[-1]
        checkpoint = {"id": str(last.id), "updated_at": iso_z(last.updated_at)}
    else:
        checkpoint = {"id": checkpoint_id or "", "updated_at": checkpoint_updated_at or _EPOCH}

    return {"documents": documents, "checkpoint": checkpoint}
