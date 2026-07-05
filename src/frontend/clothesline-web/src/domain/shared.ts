// Shared helpers used across domain/*.ts modules.

export function nowIso(): string {
  return new Date().toISOString()
}

export function todayDateName(): string {
  // Load.name defaults to today's date (spec §4.1), YYYY-MM-DD.
  return new Date().toISOString().slice(0, 10)
}

export function newId(): string {
  return crypto.randomUUID()
}

// No manual "not deleted" query filter is needed anywhere in this codebase:
// RxDB treats a schema's `_deleted` field as reserved and unconditionally
// excludes such docs from every find()/findOne() query (spec §7's tombstone
// convention) — the row still exists in local storage so it can replicate,
// it's just invisible to normal reads.
