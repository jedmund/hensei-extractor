import { describe, expect, it } from 'vitest'
import {
  detailCacheSuffix,
  npcStyleEntry,
  npcStyleName,
  npcStyleOf,
  parseDetailSuffix
} from './detail-style.js'

const styleList = [
  { name: 'Default Style', image: '3040377000_01', style: 1 },
  { name: 'Super Cidala', image: '3040377000_01_st2', style: 2 }
]
const style1 = {
  id: '3040377000',
  name: 'Cidala',
  style: 1,
  style_list: styleList
}
const style2 = { ...style1, style: 2 }
const noStyle = { id: '3040001000', name: 'Katalina' }

describe('npcStyleOf', () => {
  it.each([
    [style1, 1],
    [style2, 2],
    [noStyle, 1],
    [{ style: '2' }, 2],
    [{ style: 'x' }, 1],
    [{ style: 0 }, 1],
    [null, 1]
  ])('reads the style of %j as %i', (data, expected) => {
    expect(npcStyleOf(data)).toBe(expected)
  })
})

describe('npcStyleEntry / npcStyleName', () => {
  it('finds the style_list entry for the captured style', () => {
    expect(npcStyleEntry(style2)?.image).toBe('3040377000_01_st2')
    expect(npcStyleEntry(style1)?.name).toBe('Default Style')
    expect(npcStyleEntry(noStyle)).toBeUndefined()
  })

  it('names only later styles', () => {
    expect(npcStyleName(style2)).toBe('Super Cidala')
    expect(npcStyleName(style1)).toBeUndefined()
    expect(npcStyleName(noStyle)).toBeUndefined()
    expect(npcStyleName({ style: 2 })).toBeUndefined()
  })
})

describe('detailCacheSuffix', () => {
  it('keeps the plain id for style 1 and payloads without a style', () => {
    expect(detailCacheSuffix('detail_npc', '3040377000', style1)).toBe(
      '3040377000'
    )
    expect(detailCacheSuffix('detail_npc', '3040001000', noStyle)).toBe(
      '3040001000'
    )
  })

  it('keys later styles apart', () => {
    expect(detailCacheSuffix('detail_npc', '3040377000', style2)).toBe(
      '3040377000_style2'
    )
  })

  it('ignores style on weapons and summons', () => {
    expect(detailCacheSuffix('detail_weapon', '1040001000', { style: 2 })).toBe(
      '1040001000'
    )
  })
})

describe('parseDetailSuffix', () => {
  it.each([
    ['3040377000', { granblueId: '3040377000', style: 1 }],
    ['3040377000_style2', { granblueId: '3040377000', style: 2 }]
  ])('splits %s', (suffix, expected) => {
    expect(parseDetailSuffix(suffix)).toEqual(expected)
  })
})
