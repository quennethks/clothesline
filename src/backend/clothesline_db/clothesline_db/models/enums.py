import enum


class LoadStatus(enum.StrEnum):
    draft = "draft"
    sent = "sent"
    closed = "closed"


class CountMode(enum.StrEnum):
    auto = "auto"
    manual = "manual"


class PhotoLinkEntityType(enum.StrEnum):
    load = "load"
    load_item_category = "load_item_category"
    load_item = "load_item"
