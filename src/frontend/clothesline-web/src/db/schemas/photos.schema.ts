import type { RxJsonSchema } from 'rxdb'

export interface PhotoDocType {
  id: string
  blob_key: string | null
  content_type: string | null
  // Client-only staging flag (spec §4.1/§8.1) — bytes captured but not yet
  // uploaded. Never sent to the server; M4's push modifier strips it.
  local_only: boolean
  created_at: string
  updated_at: string
  _deleted: boolean
}

export const photoSchema: RxJsonSchema<PhotoDocType> = {
  title: 'photo',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    blob_key: { type: ['string', 'null'] },
    content_type: { type: ['string', 'null'] },
    local_only: { type: 'boolean' },
    created_at: { type: 'string', maxLength: 24 },
    updated_at: { type: 'string', maxLength: 24 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'local_only', 'created_at', 'updated_at', '_deleted'],
  indexes: ['updated_at'],
}
