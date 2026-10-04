import { describe, expect, it, vi } from 'vitest'

// The app state uses Svelte runes, which only compile inside components.
vi.mock('./state/app.svelte.js', () => ({ app: { locale: 'en' } }))

import {
  categorizeItems,
  collectionUpdatesByKey,
  countPartyMembers,
  defaultSelection,
  detailViewKind,
  filterByRarity,
  findRaidBySlug,
  hasItemNames,
  isWeaponType,
  ownedIdsFor,
  partyLookups,
  suggestedRaidSlug,
  type ItemEntry
} from './detail-data.js'
import type { CollectionUpdate, RaidGroup } from './types/messages.js'

describe('detailViewKind', () => {
  it.each([
    ['unf_scores_77', 'crewScores'],
    ['unf_daily_scores_77', 'crewScores'],
    ['party_1_2', 'party'],
    ['detail_weapon_1040001', 'database'],
    ['character_stats', 'characterStats'],
    ['support_summons', 'supportSummons'],
    ['collection_weapon', 'collection'],
    ['collection_artifact', 'collection'],
    ['list_npc', 'collection'],
    ['stash_summon_2', 'collection'],
    ['', 'other']
  ])('shows %s in the %s view', (dataType, kind) => {
    expect(detailViewKind(dataType)).toBe(kind)
  })
})

describe('isWeaponType', () => {
  it.each([
    ['collection_weapon', true],
    ['list_weapon', true],
    ['stash_weapon_3', true],
    ['collection_summon', false],
    ['party_1_2', false]
  ])('%s → %s', (dataType, expected) => {
    expect(isWeaponType(dataType)).toBe(expected)
  })
})

describe('ownedIdsFor', () => {
  const response = {
    weapons: ['w'],
    summons: ['s'],
    artifacts: ['a'],
    characters: ['c']
  }

  it.each([
    ['collection_weapon', ['w']],
    ['stash_weapon_1', ['w']],
    ['list_summon', ['s']],
    ['stash_summon_2', ['s']],
    ['collection_artifact', ['a']],
    ['collection_npc', ['c']],
    ['list_npc', ['c']],
    ['something_else', []]
  ])('picks the ids for %s', (dataType, ids) => {
    expect(ownedIdsFor(dataType, response)).toEqual(new Set(ids))
  })

  it('is empty when the lookup failed or the list is missing', () => {
    expect(
      ownedIdsFor('collection_weapon', { ...response, error: 'boom' })
    ).toEqual(new Set())
    expect(ownedIdsFor('collection_weapon', {})).toEqual(new Set())
  })
})

describe('update maps', () => {
  const updates: CollectionUpdate[] = [
    { game_id: '111', granblue_id: '1040001', changes: [] },
    { granblue_id: '3040001', changes: [] },
    { granblue_id: '', changes: [] }
  ]

  it('keys collection updates by game_id, falling back to granblue_id', () => {
    expect([...collectionUpdatesByKey(updates).keys()]).toEqual([
      '111',
      '3040001'
    ])
  })
})

describe('party data', () => {
  const party = {
    deck: {
      name: 'Wind',
      pc: {
        weapons: { 1: { id: 1 }, 2: null, 3: { id: 3 } },
        damage_info: { summon_name: 'Grimnir' },
        set_action: [
          { name: 'Rage IV' },
          { name: '' },
          { name: 'Miserable Mist' }
        ]
      },
      npc: { 1: { id: 1 }, 2: { id: 2 }, 3: null }
    }
  }

  it('lists the support summon and the job skills to look up', () => {
    expect(partyLookups(party)).toEqual({
      summonName: 'Grimnir',
      skillNames: ['Rage IV', 'Miserable Mist']
    })
    expect(partyLookups(undefined)).toEqual({
      summonName: undefined,
      skillNames: []
    })
  })

  it('counts filled weapon and character slots', () => {
    expect(countPartyMembers(party)).toEqual({ weapons: 2, characters: 2 })
    expect(countPartyMembers(undefined)).toEqual({ weapons: 0, characters: 0 })
  })
})

describe('raid suggestion', () => {
  it.each([
    [13, 8, 'versusia'],
    [13, 5, 'farming-ex'],
    [10, 5, 'farming'],
    [13, 4, null],
    [10, 8, null],
    [0, 0, null]
  ])('suggests %i weapons and %i characters → %s', (weapons, chars, slug) => {
    expect(suggestedRaidSlug(weapons, chars)).toBe(slug)
  })

  const groups = [
    {
      id: 1,
      name: { en: 'Farming' },
      section: 1,
      difficulty: 1,
      raids: [{ id: 10, name: { en: 'Farming' }, slug: 'farming' }]
    },
    {
      id: 2,
      name: { en: 'No raids' },
      section: 1,
      difficulty: 1
    },
    {
      id: 3,
      name: { en: 'Versusia' },
      section: 2,
      difficulty: 2,
      raids: [{ id: 30, name: { en: 'Versusia' }, slug: 'versusia' }]
    }
  ] satisfies RaidGroup[]

  it('finds the raid by slug and attaches its group', () => {
    expect(findRaidBySlug(groups, 'versusia')).toEqual({
      id: 30,
      name: { en: 'Versusia' },
      slug: 'versusia',
      group: groups[2]
    })
    expect(findRaidBySlug(groups, 'farming-ex')).toBeNull()
  })
})

describe('categorizeItems', () => {
  function weapon(id: string, level = 100): ItemEntry['item'] {
    return { param: { id, level } } as ItemEntry['item']
  }

  function entries(items: ItemEntry['item'][]): ItemEntry[] {
    return items.map((item, originalIndex) => ({ item, originalIndex }))
  }

  const updates = new Map([['2', { granblue_id: 'x', changes: [] }]])

  it('splits items into new, updated, unchanged and level 1 sections', () => {
    const sections = categorizeItems(
      'collection_weapon',
      entries([weapon('1'), weapon('2'), weapon('3'), weapon('4', 1)]),
      new Set(['2', '3']),
      updates
    )
    expect(
      sections.map((s) => [
        s.key,
        s.items.map((e) => e.originalIndex),
        s.defaultExpanded
      ])
    ).toEqual([
      ['will_import', [0], true],
      ['has_updates', [1], true],
      ['unchanged', [2], false],
      ['level_1', [3], false]
    ])
    expect(sections.every((s) => s.label)).toBe(true)
  })

  it('expands unchanged items when there is nothing new or updated', () => {
    const sections = categorizeItems(
      'collection_weapon',
      entries([weapon('3')]),
      new Set(['3']),
      new Map()
    )
    expect(sections.map((s) => [s.key, s.defaultExpanded])).toEqual([
      ['unchanged', true]
    ])
  })

  it('keeps level 1 characters with the rest', () => {
    const sections = categorizeItems(
      'collection_npc',
      entries([
        { master: { id: '3040001' }, param: { level: 1 } }
      ] as ItemEntry['item'][]),
      new Set(),
      new Map()
    )
    expect(sections.map((s) => s.key)).toEqual(['will_import'])
  })

  it('ticks new and updated items unless the user unticked them', () => {
    const sections = categorizeItems(
      'collection_weapon',
      entries([
        weapon('1'),
        weapon('2'),
        weapon('3'),
        weapon('4', 1),
        weapon('5')
      ]),
      new Set(['2', '3']),
      updates
    )
    expect(defaultSelection(sections, new Set([4]))).toEqual(new Set([0, 1]))
  })
})

describe('filterByRarity', () => {
  const items = [
    { master: { rarity: '4' }, name: 'SSR' },
    { rarity: 3 },
    { master: {} }
  ] as ItemEntry['item'][]

  it('keeps items whose rarity is on, and items without one, with their index', () => {
    expect(
      filterByRarity('collection_weapon', items, new Set(['4'])).map(
        (e) => e.originalIndex
      )
    ).toEqual([0, 2])
    expect(
      filterByRarity('list_npc', items, new Set(['3'])).map(
        (e) => e.originalIndex
      )
    ).toEqual([1, 2])
  })

  it('ignores the filter for artifacts', () => {
    expect(
      filterByRarity('collection_artifact', items, new Set()).map(
        (e) => e.originalIndex
      )
    ).toEqual([0, 1, 2])
  })

  it('lists named items', () => {
    const entries = filterByRarity('collection_artifact', items, new Set())
    expect(hasItemNames(entries)).toBe(true)
    expect(hasItemNames(entries.slice(1))).toBe(false)
  })
})
