import type { RxJsonSchema } from 'rxdb'

export type CountMode = 'auto' | 'manual'

export interface LoadItemCategoryDocType {
  id: string
  load_id: string
  category: string
  count_sent: number
  count_received: number | null
  count_mode: CountMode
  created_at: string
  updated_at: string
  _deleted: boolean
}

export const loadItemCategorySchema: RxJsonSchema<LoadItemCategoryDocType> = {
  title: 'load_item_category',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    load_id: { type: 'string', maxLength: 36 },
    category: { type: 'string' },
    count_sent: { type: 'number', minimum: 0 },
    count_received: { type: ['number', 'null'] },
    count_mode: { type: 'string', maxLength: 16 },
    created_at: { type: 'string', maxLength: 24 },
    updated_at: { type: 'string', maxLength: 24 },
    _deleted: { type: 'boolean' },
  },
  required: [
    'id',
    'load_id',
    'category',
    'count_sent',
    'count_mode',
    'created_at',
    'updated_at',
    '_deleted',
  ],
  indexes: ['load_id', 'updated_at'],
}
