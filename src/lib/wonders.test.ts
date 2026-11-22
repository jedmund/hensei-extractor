import { describe, expect, it } from 'vitest'
import en from './__fixtures__/memorial-list-en.json'
import { countWonders, isWonderActive, wonderLevel } from './wonders.js'

describe('countWonders', () => {
  it('counts Wonders across every category', () => {
    expect(countWonders(en)).toBe(51)
    expect(countWonders([{ category_id: '1' }, null])).toBe(0)
  })
})

describe('isWonderActive', () => {
  it('reads set_flg', () => {
    const shield = en[4]!.item.find((item) => item.item_id === '9003')!
    expect(isWonderActive(shield)).toBe(false)
    expect(isWonderActive({ item_id: '1', set_flg: '1' })).toBe(true)
  })
})

describe('wonderLevel', () => {
  it('is only shown for Wonders that level up', () => {
    expect(wonderLevel({ item_id: '9008', level: '20', max_level: 20 })).toBe(
      20
    )
    expect(
      wonderLevel({ item_id: '9013', level: '1', max_level: 1 })
    ).toBeNull()
    expect(wonderLevel({ item_id: '29' })).toBeNull()
  })
})
