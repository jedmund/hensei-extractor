import { describe, expect, it } from 'vitest'
import { npcStyleEntry, npcStyleName, npcStyleOf } from './detail-style.js'

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
    [{ param: { style: '2' } }, 2],
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
