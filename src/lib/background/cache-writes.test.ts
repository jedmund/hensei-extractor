import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheDetailItem } from './cache-writes.js'
import { closeQueueDb, getPayload, listEntries } from './import-queue.js'

vi.mock('./api-client.js', () => ({
  authenticatedPost: vi.fn(),
  getAuthToken: vi.fn(async () => ({ language: 'en' }))
}))

const storage: Record<string, unknown> = {}

beforeEach(async () => {
  await closeQueueDb()
  globalThis.indexedDB = new IDBFactory()
  storage.gbAuth = { access_token: 't', role: 7 }
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) =>
          key in storage ? { [key]: storage[key] } : {}
      }
    }
  })
})

const styleList = [
  { name: 'Default Style', image: '3040377000_01', style: 1 },
  { name: 'Super Cidala', image: '3040377000_01_st2', style: 2 }
]

describe('cacheDetailItem', () => {
  it('keeps both styles of a character', async () => {
    const style1 = {
      id: '3040377000',
      name: 'Cidala',
      style: 1,
      style_list: styleList
    }
    const style2 = { ...style1, style: 2 }

    const first = await cacheDetailItem('detail_npc', style1, 100)
    const second = await cacheDetailItem('detail_npc', style2, 200)

    expect(first).toEqual({
      dataType: 'detail_npc_3040377000_1_en',
      cached: true
    })
    expect(second).toEqual({
      dataType: 'detail_npc_3040377000_2_en',
      cached: true
    })
    expect(await getPayload('npc_3040377000_1_en')).toEqual(style1)
    expect(await getPayload('npc_3040377000_2_en')).toEqual(style2)

    const [newest, oldest] = await listEntries()
    expect(newest).toMatchObject({ style: 2, styleName: 'Super Cidala' })
    expect(oldest).toMatchObject({ style: 1 })
    expect(oldest).not.toHaveProperty('styleName')
  })

  it('treats a payload without a style as the first style', async () => {
    const data = { id: '3040001000', name: 'Katalina' }
    const result = await cacheDetailItem('detail_npc', data, 100)

    expect(result.dataType).toBe('detail_npc_3040001000_1_en')
  })
})
