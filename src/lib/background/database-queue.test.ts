import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import jpCharacter from '../__fixtures__/npc-detail-jp.json'
import {
  getImportQueue,
  importQueueAll,
  importQueuedItem,
  queueDetailCapture,
  removeLegacyDetailCache
} from './database-queue.js'
import {
  closeQueueDb,
  getEntry,
  getPayload,
  listEntries,
  putCapture,
  setStatus
} from './import-queue.js'

vi.mock('./api-client.js', () => ({
  authenticatedPost: vi.fn(),
  getAuthToken: vi.fn(async () => ({ language: 'en' }))
}))

let storage: Record<string, unknown>

beforeEach(async () => {
  await closeQueueDb()
  globalThis.indexedDB = new IDBFactory()
  storage = { gbAuth: { access_token: 't', role: 7 } }
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key?: string | null) =>
          typeof key === 'string'
            ? key in storage
              ? { [key]: storage[key] }
              : {}
            : { ...storage },
        getKeys: async () => Object.keys(storage),
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, items)
        },
        remove: async (keys: string[]) => {
          for (const key of keys) delete storage[key]
        }
      }
    }
  })
})

async function queue(granblueId: string, capturedAt = 1000) {
  return putCapture(
    {
      key: `weapon_${granblueId}_1_en`,
      type: 'weapon',
      granblueId,
      name: `Weapon ${granblueId}`,
      lang: 'en',
      style: 1,
      capturedAt
    },
    { id: granblueId }
  )
}

describe('queueDetailCapture', () => {
  it('queues a journal page for an editor without its URL', async () => {
    const key = await queueDetailCapture('detail_npc', jpCharacter, 1000)

    expect(key).toBe('npc_3040377000_2_jp')
    expect(await getPayload(key!)).toEqual(jpCharacter)
    const [entry] = await listEntries()
    expect(entry).toMatchObject({ lang: 'jp', style: 2, status: 'queued' })
    expect(JSON.stringify(entry)).not.toContain('http')
  })

  it('queues nothing for an account that is not an editor', async () => {
    storage.gbAuth = { access_token: 't', role: 3 }

    expect(await queueDetailCapture('detail_npc', jpCharacter, 1)).toBeNull()
    expect(await listEntries()).toEqual([])
  })
})

describe('importQueuedItem', () => {
  it('sends the entry with its language and removes it on success', async () => {
    const entry = await queue('1040001000')
    const upload = vi.fn(async () => ({ success: true }))

    expect(await importQueuedItem(entry.key, { upload })).toEqual({
      success: true
    })
    expect(upload).toHaveBeenCalledWith(
      { id: '1040001000' },
      'detail_weapon',
      'en'
    )
    expect(await getEntry(entry.key)).toBeNull()
    expect(await getPayload(entry.key)).toBeNull()
  })

  it('keeps a failed entry with its error', async () => {
    const entry = await queue('1040001000')
    const upload = vi.fn(async () => ({ error: 'not_found' }))

    await importQueuedItem(entry.key, { upload })

    expect(await getEntry(entry.key)).toMatchObject({
      status: 'failed',
      error: 'not_found'
    })
    expect(await getPayload(entry.key)).toEqual({ id: '1040001000' })
  })

  it('puts the entry back as queued on a login error', async () => {
    const entry = await queue('1040001000')
    const upload = vi.fn(async () => ({ error: 'invalid_token' }))

    await importQueuedItem(entry.key, { upload })

    const stored = await getEntry(entry.key)
    expect(stored?.status).toBe('queued')
    expect(stored).not.toHaveProperty('error')
  })

  it('reports an entry that is gone', async () => {
    const upload = vi.fn()
    expect(await importQueuedItem('weapon_1_1_en', { upload })).toEqual({
      error: 'no_cached_data'
    })
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('importQueueAll', () => {
  it('removes successes, keeps failures and broadcasts progress', async () => {
    await queue('1', 3000)
    await queue('2', 2000)
    await queue('3', 1000)
    const upload = vi.fn(async (data: Record<string, unknown>) =>
      data.id === '2' ? { error: 'server_error' } : { success: true }
    )
    const notify = vi.fn(async () => undefined)

    const summary = await importQueueAll({ upload, notify })

    expect(summary).toEqual({
      done: 3,
      total: 3,
      imported: 2,
      failed: 1,
      stoppedBy: null
    })
    const remaining = await listEntries()
    expect(remaining).toEqual([
      expect.objectContaining({
        granblueId: '2',
        status: 'failed',
        error: 'server_error'
      })
    ])
    expect(notify).toHaveBeenLastCalledWith({
      action: 'importQueueProgress',
      progress: { done: 3, total: 3, imported: 2, failed: 1 }
    })
  })

  it('retries failed entries on the next run', async () => {
    const entry = await queue('1')
    await setStatus(entry.key, entry.capturedAt, 'failed', 'server_error')
    const upload = vi.fn(async () => ({ success: true }))

    await importQueueAll({ upload, notify: async () => undefined })

    expect(upload).toHaveBeenCalledTimes(1)
    expect(await listEntries()).toEqual([])
  })

  it('stops on a login error and leaves the rest queued', async () => {
    await queue('1', 3000)
    await queue('2', 2000)
    const upload = vi.fn(async () => ({ error: 'invalid_token' }))

    const summary = await importQueueAll({
      upload,
      notify: async () => undefined
    })

    expect(upload).toHaveBeenCalledTimes(1)
    expect(summary).toMatchObject({ stoppedBy: 'invalid_token', done: 0 })
    const remaining = await listEntries()
    expect(remaining.map((e) => e.status)).toEqual(['queued', 'queued'])
  })

  it('runs only once at a time', async () => {
    await queue('1')
    let release!: () => void
    const upload = vi.fn(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          release = () => resolve({ success: true })
        })
    )
    const notify = async () => undefined

    const first = importQueueAll({ upload, notify })
    expect(await importQueueAll({ upload, notify })).toEqual({
      error: 'already_running'
    })
    await vi.waitFor(() => expect(upload).toHaveBeenCalled())
    expect((await getImportQueue()).progress).toMatchObject({ total: 1 })

    release()
    await first
    expect((await getImportQueue()).progress).toBeNull()
  })
})

describe('getImportQueue', () => {
  it('counts an entry left importing by a stopped worker as queued', async () => {
    const entry = await queue('1')
    await setStatus(entry.key, entry.capturedAt, 'importing')

    const state = await getImportQueue()

    expect(state.entries[0]?.status).toBe('queued')
    expect(state.counts).toMatchObject({ total: 1, failed: 0 })
    expect(state.progress).toBeNull()
  })
})

describe('removeLegacyDetailCache', () => {
  it('removes the old detail captures once', async () => {
    storage['gbf_cache_detail_npc_3040001000'] = { data: {}, url: 'x' }
    storage['gbf_cache_party_1_1'] = { data: {} }

    await removeLegacyDetailCache()

    expect(storage).not.toHaveProperty('gbf_cache_detail_npc_3040001000')
    expect(storage).toHaveProperty('gbf_cache_party_1_1')
    expect(storage.legacyDetailCacheCleared).toBe(true)

    storage['gbf_cache_detail_npc_3040001000'] = { data: {} }
    await removeLegacyDetailCache()
    expect(storage).toHaveProperty('gbf_cache_detail_npc_3040001000')
  })
})
