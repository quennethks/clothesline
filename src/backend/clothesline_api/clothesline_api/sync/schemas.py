import uuid
from datetime import UTC, date, datetime
from enum import Enum


def iso_z(dt: datetime) -> str:
    """ISO 8601 UTC with a trailing Z (spec §4) — Python's stdlib isoformat()
    for a tz-aware datetime produces '+00:00', not 'Z'."""
    return dt.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def serialize_value(value: object) -> object:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, datetime):
        return iso_z(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


def row_to_wire(row: object, fields: tuple[str, ...]) -> dict[str, object]:
    doc: dict[str, object] = {"id": str(row.id)}  # type: ignore[attr-defined]
    for field in fields:
        doc[field] = serialize_value(getattr(row, field))
    doc["created_at"] = iso_z(row.created_at)  # type: ignore[attr-defined]
    doc["updated_at"] = iso_z(row.updated_at)  # type: ignore[attr-defined]
    doc["_deleted"] = row.deleted_at is not None  # type: ignore[attr-defined]
    return doc
