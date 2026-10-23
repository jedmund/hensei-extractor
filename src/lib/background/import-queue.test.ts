import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jpCharacter from '../__fixtures__/npc-detail-jp.json'
import {
  clearQueue,
  closeQueueDb,
  countEntries,
  describeCapture,
  getEntry,
  getPayload,
  listEntries,
  putCapture,
  queueDataType,
  queueKeyFromDataType,
  removeImported,
  setStatus,
  type QueueCapture
} from './import-queue.js'

beforeEach(async () => {
  await closeQueueDb()
  globalThis.indexedDB = new IDBFactory()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function character(
  overrides: Partial<QueueCapture> = {}
): QueueCapture & { payload: Record<string, unknown> } {
  const capture = describeCapture(
    'detail_npc',
    { id: '3040001000', name: 'Katalina', param: { style: '1' } },
    'en',
    1000
  )!
  const merged = { ...capture, ...overrides }
  return {
    ...merged,
    key: `${merged.type}_${merged.granblueId}_${merged.style}_${merged.lang}`,
    payload: { id: merged.granblueId, name: merged.name }
  }
}

async function add(capture: ReturnType<typeof character>) {
  const { payload, ...meta } = capture
  return putCapture(meta, payload)
}

describe('describeCapture', () => {
  it('keys a capture by type, ID, style and language', () => {
    const capture = describeCapture(
      'detail_weapon',
      { id: '1040001000', name: 'Sword' },
      'jp',
      5
    )
    expect(capture).toEqual({
      key: 'weapon_1040001000_1_jp',
      type: 'weapon',
      granblueId: '1040001000',
      name: 'Sword',
      lang: 'jp',
      style: 1,
      capturedAt: 5
    })
  })

  it('reads the ID and style of a real archive character payload', () => {
    const capture = describeCapture('detail_npc', jpCharacter, 'jp', 5)
    expect(capture).toMatchObject({
      key: 'npc_3040377000_2_jp',
      granblueId: '3040377000',
      name: 'シンダラ',
      style: 2
    })
  })

  it('ignores anything without an ID or outside the journal', () => {
    expect(describeCapture('detail_npc', { name: 'x' }, 'en', 1)).toBeNull()
    expect(describeCapture('party', { id: '1' }, 'en', 1)).toBeNull()
  })

  it('maps entries to data types and back', () => {
    const dataType = queueDataType('npc_3040377000_2_jp')
    expect(dataType).toBe('detail_npc_3040377000_2_jp')
    expect(queueKeyFromDataType(dataType)).toBe('npc_3040377000_2_jp')
    expect(queueKeyFromDataType('detail_npc_3040377000')).toBeNull()
    expect(queueKeyFromDataType('party_1_1')).toBeNull()
  })
})

describe('import queue store', () => {
  it('keeps English, Japanese and style-shift captures apart', async () => {
    await add(character())
    await add(character({ lang: 'jp', name: 'カタリナ' }))
    await add(character({ style: 2 }))

    const keys = (await listEntries()).map((e) => e.key).sort()
    expect(keys).toEqual([
      'npc_3040001000_1_en',
      'npc_3040001000_1_jp',
      'npc_3040001000_2_en'
    ])
  })

  it('replaces an entry with the newest capture and queues it again', async () => {
    const first = await add(character())
    await setStatus(first.key, first.capturedAt, 'failed', 'not_found')
    await add(character({ capturedAt: 2000, name: 'Katalina (new)' }))

    const entries = await listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      name: 'Katalina (new)',
      capturedAt: 2000,
      status: 'queued'
    })
    expect(entries[0]).not.toHaveProperty('error')
    expect(await getPayload(first.key)).toEqual({
      id: '3040001000',
      name: 'Katalina (new)'
    })
  })

  it('lists and counts entries without reading payloads', async () => {
    await add(character())
    await add(character({ lang: 'jp', capturedAt: 3000 }))
    await add(
      character({ type: 'weapon', granblueId: '1040001000', capturedAt: 2000 })
    )
    const failed = await add(
      character({ type: 'summon', granblueId: '2040001000', capturedAt: 500 })
    )
    await setStatus(failed.key, failed.capturedAt, 'failed', 'not_found')

    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction')
    const entries = await listEntries()

    const stores = transaction.mock.calls.flatMap(([names]) =>
      typeof names === 'string' ? [names] : [...names]
    )
    expect(stores).toEqual(['entries'])
    expect(entries.map((e) => e.capturedAt)).toEqual([3000, 2000, 1000, 500])
    expect(entries.every((e) => !('payload' in e))).toBe(true)
    expect(entries.every((e) => !('url' in e))).toBe(true)

    expect(countEntries(entries)).toEqual({
      total: 4,
      failed: 1,
      byType: {
        npc: { en: 1, jp: 1 },
        weapon: { en: 1, jp: 0 },
        summon: { en: 1, jp: 0 }
      }
    })
  })

  it('moves an entry through importing and failed', async () => {
    const entry = await add(character())

    expect(await setStatus(entry.key, 1000, 'importing')).toBe(true)
    expect((await getEntry(entry.key))?.status).toBe('importing')

    expect(await setStatus(entry.key, 1000, 'failed', 'server_error')).toBe(
      true
    )
    expect(await getEntry(entry.key)).toMatchObject({
      status: 'failed',
      error: 'server_error'
    })

    expect(await setStatus(entry.key, 1000, 'queued')).toBe(true)
    expect(await getEntry(entry.key)).not.toHaveProperty('error')
  })

  it("leaves a newer capture's status alone", async () => {
    const entry = await add(character())
    await add(character({ capturedAt: 2000 }))

    expect(await setStatus(entry.key, 1000, 'failed', 'x')).toBe(false)
    expect((await getEntry(entry.key))?.status).toBe('queued')
  })

  it('removes an imported entry and its payload', async () => {
    const entry = await add(character())

    expect(await removeImported(entry.key, 1000)).toBe(true)
    expect(await getEntry(entry.key)).toBeNull()
    expect(await getPayload(entry.key)).toBeNull()
  })

  it('keeps an entry recaptured while it was importing', async () => {
    const entry = await add(character())
    await add(character({ capturedAt: 2000 }))

    expect(await removeImported(entry.key, 1000)).toBe(false)
    expect((await getEntry(entry.key))?.capturedAt).toBe(2000)
  })

  it('clears every entry', async () => {
    await add(character())
    await add(character({ lang: 'jp' }))

    await clearQueue()

    expect(await listEntries()).toEqual([])
    expect(await getPayload('npc_3040001000_1_en')).toBeNull()
  })
})
