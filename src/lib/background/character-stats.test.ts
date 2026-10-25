import { describe, expect, it, vi } from 'vitest'
import {
  cacheCharacterStats,
  parseZenithMasteryData
} from './character-stats.js'

vi.mock('../mastery.js', () => ({
  OVER_MASTERY_TYPE_ID: {
    20001: 9,
    20003: 7
  },
  lookupAetherialTypeId: (typeId: number) =>
    String(typeId).endsWith('0006') ? 3 : null,
  parseDisplayValue: (value: string | undefined) =>
    parseInt(String(value ?? '').replace(/^\+/, ''), 10) || 0
}))

describe('parseZenithMasteryData', () => {
  it('parses ring, over-mastery and earring bonuses, ignoring the perpetuity list', () => {
    const result = parseZenithMasteryData({
      option: {
        character: { name: 'Lyria' },
        npcaugment: {
          param_data: [
            {
              type: { id: 1, name: 'ATK', split_key: 0 },
              param: { disp_total_param: '+1000' },
              slot_number: 1
            },
            {
              type: { id: 20001, name: 'Critical Hit' },
              param: { disp_total_param: '+10%' },
              slot_number: 2
            },
            {
              type: { id: 90006, name: 'Element ATK' },
              param: { disp_total_param: '+12%' },
              slot_number: 4
            },
            {
              type: { id: 20003, name: 'Ignored' },
              param: { disp_total_param: '+0%' },
              slot_number: 3
            }
          ],
          constant_data_list: {
            first: [
              {
                type: { id: 100002, name: 'ATK' },
                param: { disp_total_param: '+5%' }
              }
            ]
          }
        }
      }
    })

    expect(result).toEqual({
      masterName: 'Lyria',
      rings: [
        {
          modifier: 1,
          strength: 1000,
          typeName: 'ATK',
          slot: 1
        },
        {
          modifier: 9,
          strength: 10,
          typeName: 'Critical Hit',
          slot: 2
        }
      ],
      earring: {
        modifier: 3,
        strength: 12,
        typeName: 'Element ATK'
      }
    })
  })

  it('returns empty mastery data when the response has no augment option', () => {
    expect(parseZenithMasteryData({})).toEqual({
      rings: [],
      earring: null,
      masterName: null
    })
  })
})

describe('cacheCharacterStats with archive captures', () => {
  it('leaves stats alone for an archive payload, which has no master', async () => {
    const set = vi.fn()
    vi.stubGlobal('chrome', {
      storage: { local: { get: async () => ({}), set } }
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // /archive/npc_detail sends id and style, never master or param
    const style2 = { id: '3040377000', name: 'Cidala', style: 2 }
    const cached = await cacheCharacterStats(
      'character_detail',
      style2,
      null,
      100,
      'u'
    )

    expect(cached).toBe(false)
    expect(set).not.toHaveBeenCalled()
  })
})
