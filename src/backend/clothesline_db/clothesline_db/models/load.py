import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from clothesline_db.models.base import Base, SyncedMixin
from clothesline_db.models.enums import LoadStatus

if TYPE_CHECKING:
    from clothesline_db.models.load_item_category import LoadItemCategory


class Load(Base, SyncedMixin):
    """The core record (spec §4.1, PRD §4.2/§4.6/§4.7)."""

    __tablename__ = "loads"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str]
    shop_name: Mapped[str | None] = mapped_column(default=None)
    shop_location: Mapped[str | None] = mapped_column(default=None)
    send_date: Mapped[date | None] = mapped_column(default=None)
    status: Mapped[LoadStatus] = mapped_column(
        Enum(LoadStatus, native_enum=False, length=16), default=LoadStatus.draft
    )
    total_sent: Mapped[int] = mapped_column(default=0)
    total_received: Mapped[int | None] = mapped_column(default=None)
    reconciled: Mapped[bool] = mapped_column(default=False)

    categories: Mapped[list["LoadItemCategory"]] = relationship(
        back_populates="load", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_loads_user_id_updated_at_id", "user_id", "updated_at", "id"),)
