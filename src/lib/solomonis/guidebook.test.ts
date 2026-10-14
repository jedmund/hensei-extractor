import { describe, expect, it } from 'vitest'
import { guidebookEffectName, guidebookSections } from './guidebook.js'
import type { SolomonisStatus } from './types.js'

const status = (
  status_id: number,
  rarity: number,
  num: number,
  name = `Effect ${status_id}`
): SolomonisStatus => ({ status_id, rarity, num, name })

describe('guidebookEffectName', () => {
  it('drops the line-break markers', () => {
    expect(guidebookEffectName('Chain burst DMG +50% / Chain burst @@DMG cap +30%')).toBe(
      'Chain burst DMG +50% / Chain burst DMG cap +30%'
    )
  })

  it('is empty for a missing name', () => {
    expect(guidebookEffectName(undefined)).toBe('')
  })
})

describe('guidebookSections', () => {
  it('groups by rarity in the game order, keeping the order within a group', () => {
    const sections = guidebookSections([
      status(1, 1, 2),
      status(117, 99, 1),
      status(51, 2, 1),
      status(90, 3, 1),
      status(20, 2, 3)
    ])

    expect(sections.map((s) => s.rarity)).toEqual(['unique', 'rare', 'normal', 'cursed'])
    expect(sections[1]!.entries.map((e) => e.statusId)).toEqual([51, 20])
    expect(sections[1]!.stacks).toBe(4)
  })

  it('leaves out entries with an unknown rarity or no name', () => {
    expect(guidebookSections([status(1, 7, 1), { status_id: 2, rarity: 1, num: 1 }])).toEqual([])
  })

  it('keeps each effect\'s icon and whether it stacks', () => {
    const [section] = guidebookSections([
      { status_id: 90, rarity: 3, num: 1, name: 'Effect', icon_category: 1, icon_type: 401, is_duplication_possible: 1 }
    ])
    expect(section!.entries[0]).toMatchObject({
      rarity: 'unique',
      stackable: true,
      iconType: 401,
      iconCategory: 'offence'
    })
  })

  it('falls back to the rarity for an unknown icon category', () => {
    const [section] = guidebookSections([{ status_id: 117, rarity: 99, num: 1, name: 'Curse', icon_category: 9 }])
    expect(section!.entries[0]).toMatchObject({ iconType: 0, iconCategory: 'cursed', stackable: false })
  })

  it('counts a missing stack count as one', () => {
    expect(guidebookSections([{ status_id: 1, rarity: 1, name: 'ATK +20%' }])[0]!.entries[0]!.count).toBe(1)
  })

  it('is empty without a log', () => {
    expect(guidebookSections(null)).toEqual([])
  })
})
