import { describe, expect, it } from 'vitest'
import {
  characterStatsToItems,
  collectPageItems,
  extractFilterFromPages,
  parseGameFilter,
  resolveEndpoint
} from './collections.js'

describe('collection helpers', () => {
  it('collects page items in page insertion order', () => {
    expect(
      collectPageItems({
        1: { list: ['a', 'b'] },
        2: { list: ['c'] },
        3: {}
      })
    ).toEqual(['a', 'b', 'c'])
  })

  it.each([
    ['collection_npc', 'characters'],
    ['list_weapon', 'weapons'],
    ['detail_summon_2040001', 'summons'],
    ['stash_weapon_2', 'weapons'],
    ['collection_artifact', 'artifacts'],
    ['unknown', null]
  ])('resolves %s to %s', (dataType, endpoint) => {
    expect(resolveEndpoint(dataType)).toBe(endpoint)
  })

  it('parses active element and proficiency filters', () => {
    expect(
      parseGameFilter({
        filter: {
          '6': '100010',
          '8': '0100000001'
        }
      })
    ).toEqual({
      elements: [2, 6],
      proficiencies: [2, 10]
    })
  })

  it('returns null for inactive filters and finds filters on either page shape', () => {
    expect(
      parseGameFilter({
        filter: {
          '6': '000000',
          '8': '0000000000'
        }
      })
    ).toBeNull()

    expect(
      extractFilterFromPages({
        1: {},
        2: { option: { filter: { '6': '000001' } } }
      })
    ).toEqual({ elements: [5], proficiencies: null })
  })

  it('converts captured character stats into import payloads', () => {
    expect(
      characterStatsToItems({
        '3040001': {
          masterId: '3040001',
          uncapLevel: 5,
          transcendenceStep: 2,
          awakening: { type: 1, level: 8 },
          rings: [
            { modifier: 9, strength: 10 },
            { modifier: 0, strength: 5 }
          ],
          earring: { modifier: 3, strength: 12 },
          perpetuity: false
        }
      })
    ).toEqual([
      {
        granblue_id: '3040001',
        uncap_level: 5,
        transcendence_step: 2,
        awakening_type: 1,
        awakening_level: 8,
        ring1: { modifier: 9, strength: 10 },
        earring: { modifier: 3, strength: 12 },
        perpetuity: false
      }
    ])
  })
})
