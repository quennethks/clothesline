import type { RxJsonSchema } from 'rxdb'

export type LoadStatus = 'draft' | 'sent' | 'closed'

export interface LoadDocType {
  id: string
  user_id: string
  name: string
  shop_name: string | null
  shop_location: string | null
  send_date: string | null
  status: LoadStatus
  total_sent: number
  total_received: number | null
  reconciled: boolean
  created_at: string
  updated_at: string
  _deleted: boolean
}

export const loadSchema: RxJsonSchema<LoadDocType> = {
  title: 'load',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    user_id: { type: 'string' },
    name: { type: 'string' },
    shop_name: { type: ['string', 'null'] },
    shop_location: { type: ['string', 'null'] },
    send_date: { type: ['string', 'null'] },
    status: { type: 'string', maxLength: 16 },
    total_sent: { type: 'number', minimum: 0 },
    total_received: { type: ['number', 'null'] },
    reconciled: { type: 'boolean' },
    created_at: { type: 'string', maxLength: 24 },
    updated_at: { type: 'string', maxLength: 24 },
    _deleted: { type: 'boolean' },
  },
  required: [
    'id',
    'user_id',
    'name',
    'status',
    'total_sent',
    'reconciled',
    'created_at',
    'updated_at',
    '_deleted',
  ],
  indexes: ['updated_at'],
}
