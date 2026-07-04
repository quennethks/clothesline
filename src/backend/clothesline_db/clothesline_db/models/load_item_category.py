import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from clothesline_db.models.base import Base, SyncedMixin
from clothesline_db.models.enums import CountMode

if TYPE_CHECKING:
    from clothesline_db.models.load import Load
    from clothesline_db.models.load_item import LoadItem


class LoadItemCategory(Base, SyncedMixin):
    """One row per clothing category present on a load — the tap-counter row
    (spec §4.1/§4.3)."""

    __tablename__ = "load_item_categories"

    load_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("loads.id"))
    category: Mapped[str]
    count_sent: Mapped[int] = mapped_column(default=0)
    count_received: Mapped[int | None] = mapped_column(default=None)
    count_mode: Mapped[CountMode] = mapped_column(
        Enum(CountMode, native_enum=False, length=16), default=CountMode.auto
    )

    load: Mapped["Load"] = relationship(back_populates="categories")
    items: Mapped[list["LoadItem"]] = relationship(
        back_populates="category", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_load_item_categories_load_id_updated_at_id", "load_id", "updated_at", "id"),
    )
