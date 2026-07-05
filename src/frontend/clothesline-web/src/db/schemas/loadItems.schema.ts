import type { RxJsonSchema } from 'rxdb'

export interface LoadItemDocType {
  id: string
  load_item_category_id: string
  name: string
  created_at: string
  updated_at: string
  _deleted: boolean
}

export const loadItemSchema: RxJsonSchema<LoadItemDocType> = {
  title: 'load_item',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    load_item_category_id: { type: 'string', maxLength: 36 },
    name: { type: 'string' },
    created_at: { type: 'string', maxLength: 24 },
    updated_at: { type: 'string', maxLength: 24 },
    _deleted: { type: 'boolean' },
  },
  required: [
    'id',
    'load_item_category_id',
    'name',
    'created_at',
    'updated_at',
    '_deleted',
  ],
  indexes: ['load_item_category_id', 'updated_at'],
}
