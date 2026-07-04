import uuid

from sqlalchemy import Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from clothesline_db.models.base import Base, SyncedMixin
from clothesline_db.models.enums import PhotoLinkEntityType


class PhotoLink(Base, SyncedMixin):
    """Junction linking a Photo to any entity it's attached to. Polymorphic and
    many-to-many capable by design (spec §4.1); MVP enforces one photo per
    entity at the application layer, not the schema."""

    __tablename__ = "photo_links"

    photo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("photos.id"))
    entity_type: Mapped[PhotoLinkEntityType] = mapped_column(
        Enum(PhotoLinkEntityType, native_enum=False, length=32)
    )
    entity_id: Mapped[uuid.UUID]
    is_primary: Mapped[bool] = mapped_column(default=False)

    __table_args__ = (
        UniqueConstraint(
            "photo_id", "entity_type", "entity_id", name="uq_photo_links_photo_entity"
        ),
        Index("ix_photo_links_entity_type_entity_id", "entity_type", "entity_id"),
    )
