from sqlalchemy.orm import Mapped, mapped_column

from clothesline_db.models.base import Base, SyncedMixin


class Photo(Base, SyncedMixin):
    """A standalone image record; attachment to an entity is expressed via
    PhotoLink (spec §4.1/§8). `local_only` is a client-only RxDB flag and has
    no server-side column — the server never sees it."""

    __tablename__ = "photos"

    blob_key: Mapped[str | None] = mapped_column(default=None)
    content_type: Mapped[str | None] = mapped_column(default=None)
