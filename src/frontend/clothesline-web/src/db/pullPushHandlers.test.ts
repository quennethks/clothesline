import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPullHandler,
  createPushHandler,
  defaultLocalOnly,
  stripLocalOnly,
} from './pullPushHandlers'

describe('pullPushHandlers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pull sends the checkpoint as query params and returns the parsed body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [{ id: 'a' }],
        checkpoint: { id: 'a', updated_at: '2026-01-01T00:00:00.000Z' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createPullHandler('loads', () => 'test-token')
    const result = await handler({ id: 'prev', updated_at: '2025-01-01T00:00:00.000Z' }, 50)

    expect(result.documents).toEqual([{ id: 'a' }])
    expect(result.checkpoint).toEqual({ id: 'a', updated_at: '2026-01-01T00:00:00.000Z' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/sync/loads?')
    expect(url).toContain('id=prev')
    expect(url).toContain('batch_size=50')
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer test-token')
  })

  it('pull omits checkpoint params on the first sync', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ documents: [], checkpoint: { id: '', updated_at: '' } }) })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createPullHandler('loads', () => undefined)
    await handler(undefined, 100)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).not.toContain('id=')
    expect((init.headers as Headers).has('Authorization')).toBe(false)
  })

  it('push maps camelCase rows to the snake_case wire contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createPushHandler('loads', () => 'test-token')
    await handler([
      { newDocumentState: { id: 'a' }, assumedMasterState: { id: 'a', name: 'old' } },
    ])

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual([
      { new_document_state: { id: 'a' }, assumed_master_state: { id: 'a', name: 'old' } },
    ])
  })

  it('push defaults assumed_master_state to null for a create', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createPushHandler('loads', () => undefined)
    await handler([{ newDocumentState: { id: 'a' } }])

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body[0].assumed_master_state).toBeNull()
  })

  it('push filters out null conflict entries (rejected creates)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'a' }, null] })
    vi.stubGlobal('fetch', fetchMock)

    const handler = createPushHandler('photo_links', () => 'test-token')
    const conflicts = await handler([{ newDocumentState: { id: 'a' } }, { newDocumentState: { id: 'b' } }])

    expect(conflicts).toEqual([{ id: 'a' }])
  })

  it('pull/push handlers throw on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(createPullHandler('loads', () => undefined)(undefined, 10)).rejects.toThrow()
    await expect(createPushHandler('loads', () => undefined)([])).rejects.toThrow()
  })
})

describe('local_only strip/default', () => {
  it('strips local_only before push', () => {
    const stripped = stripLocalOnly({ id: 'p1', local_only: true })
    expect(stripped).toEqual({ id: 'p1' })
    expect('local_only' in stripped).toBe(false)
  })

  it('defaults local_only to false on pull when absent', () => {
    const withDefault = defaultLocalOnly({ id: 'p1' } as { id: string; local_only?: boolean })
    expect(withDefault.local_only).toBe(false)
  })

  it('preserves an existing local_only value on pull', () => {
    const withDefault = defaultLocalOnly({ id: 'p1', local_only: true })
    expect(withDefault.local_only).toBe(true)
  })
})
