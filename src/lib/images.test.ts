import { describe, expect, it } from 'vitest'
import {
  getElementIconUrl,
  getImageIdSuffix,
  getPlaceholderImageUrl,
  getSummonImageUrl
} from './images.js'

describe('getImageIdSuffix', () => {
  it('returns the alt-art suffix the game encodes', () => {
    expect(getImageIdSuffix('2040094000', '2040094000_04')).toBe('_04')
    expect(getImageIdSuffix(2040065000, '2040065000_02')).toBe('_02')
  })

  it('is empty for base art, a missing ID, or an ID for another item', () => {
    expect(getImageIdSuffix('2040158000', '2040158000')).toBe('')
    expect(getImageIdSuffix('2040158000', undefined)).toBe('')
    expect(getImageIdSuffix('2040158000', '2040094000_04')).toBe('')
  })
})

describe('getSummonImageUrl', () => {
  it('builds the variant path with the uncap suffix', () => {
    expect(getSummonImageUrl('2040094000', 'main', '2040094000_04')).toMatch(
      /\/summons\/main\/2040094000_04\.jpg$/
    )
    expect(getSummonImageUrl('2040158000', 'square')).toMatch(
      /\/summons\/square\/2040158000\.jpg$/
    )
  })

  it('falls back to the placeholder without an ID', () => {
    expect(getSummonImageUrl(null, 'main')).toBe(
      getPlaceholderImageUrl('summon', 'main')
    )
    expect(getPlaceholderImageUrl('summon', 'main')).toMatch(
      /\/app\/placeholders\/placeholder-summon-main\.png$/
    )
  })
})

describe('getElementIconUrl', () => {
  it('points at the round icon, with null for Misc', () => {
    expect(getElementIconUrl('fire')).toMatch(/\/icons\/elements\/fire\.png$/)
    expect(getElementIconUrl('null')).toMatch(/\/icons\/elements\/null\.png$/)
  })
})
