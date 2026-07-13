// Default category template (spec §4.3) — bundled with the client so a new
// load can be itemized fully offline. The server treats this as a default
// only; it accepts arbitrary category strings, not a closed allow-list.
export const DEFAULT_CATEGORIES = [
  'Shirts',
  'Trousers',
  'Shorts',
  'Underwear',
  'Socks',
  'Towels',
  'Bedsheets',
  'Jackets',
  'Dresses',
  'Other',
] as const
