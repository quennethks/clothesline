import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from clothesline_db.models.base import Base, SyncedMixin

if TYPE_CHECKING:
    from clothesline_db.models.load_item_category import LoadItemCategory


class LoadItem(Base, SyncedMixin):
    """An individual, specific item within a category (spec §4.1). Auto-created
    when a photo is captured (M6); name defaults to the category name."""

    __tablename__ = "load_items"

    load_item_category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("load_item_categories.id"))
    name: Mapped[str]

    category: Mapped["LoadItemCategory"] = relationship(back_populates="items")

    __table_args__ = (
        Index(
            "ix_load_items_load_item_category_id_updated_at_id",
            "load_item_category_id",
            "updated_at",
            "id",
        ),
    )
