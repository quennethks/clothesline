import type { RxJsonSchema } from 'rxdb'

export type PhotoLinkEntityType = 'load' | 'load_item_category' | 'load_item'

export interface PhotoLinkDocType {
  id: string
  photo_id: string
  entity_type: PhotoLinkEntityType
  entity_id: string
  is_primary: boolean
  created_at: string
  updated_at: string
  _deleted: boolean
}

export const photoLinkSchema: RxJsonSchema<PhotoLinkDocType> = {
  title: 'photo_link',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    photo_id: { type: 'string', maxLength: 36 },
    entity_type: { type: 'string', maxLength: 32 },
    entity_id: { type: 'string', maxLength: 36 },
    is_primary: { type: 'boolean' },
    created_at: { type: 'string', maxLength: 24 },
    updated_at: { type: 'string', maxLength: 24 },
    _deleted: { type: 'boolean' },
  },
  required: [
    'id',
    'photo_id',
    'entity_type',
    'entity_id',
    'is_primary',
    'created_at',
    'updated_at',
    '_deleted',
  ],
  indexes: ['entity_type', 'photo_id'],
}
