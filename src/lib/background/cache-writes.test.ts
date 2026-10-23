import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cacheDetailItem } from './cache-writes.js'

let storage: Record<string, unknown>

beforeEach(() => {
  storage = {}
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, structuredClone(items))
        }
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

    const first = await cacheDetailItem('detail_npc', style1, 100, 'u1')
    const second = await cacheDetailItem('detail_npc', style2, 200, 'u2')

    expect(first).toEqual({ dataType: 'detail_npc_3040377000', cached: true })
    expect(second).toEqual({
      dataType: 'detail_npc_3040377000_style2',
      cached: true
    })
    expect(storage['gbf_cache_detail_npc_3040377000']).toMatchObject({
      data: style1,
      granblueId: '3040377000',
      itemName: 'Cidala'
    })
    expect(storage['gbf_cache_detail_npc_3040377000_style2']).toMatchObject({
      data: style2,
      granblueId: '3040377000',
      itemName: 'Cidala'
    })
  })

  it('keys a payload without a style by its id', async () => {
    const data = { id: '3040001000', name: 'Katalina' }
    const result = await cacheDetailItem('detail_npc', data, 100, 'u')

    expect(result.dataType).toBe('detail_npc_3040001000')
    expect(storage).toHaveProperty('gbf_cache_detail_npc_3040001000')
  })
})
