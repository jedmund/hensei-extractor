import { describe, expect, it } from 'vitest'
import {
  getCharacterArtFallbacks,
  getCharacterBaseArtUrl,
  toHenseiElement,
  getElementIconUrl,
  getImageIdSuffix,
  getPlaceholderImageUrl,
  getSummonImageUrl
} from './images.js'

describe('getCharacterBaseArtUrl', () => {
  const dir = 'https://siero-img.s3-us-west-2.amazonaws.com/characters/square'

  it('falls back from a pose to the base _01 art', () => {
    expect(getCharacterBaseArtUrl(`${dir}/3040643000_03.jpg`)).toBe(
      `${dir}/3040643000_01.jpg`
    )
    expect(getCharacterBaseArtUrl(`${dir}/3040643000_04.jpg`)).toBe(
      `${dir}/3040643000_01.jpg`
    )
  })

  it('falls back from style and variant art to _01', () => {
    expect(getCharacterBaseArtUrl(`${dir}/3040643000_01_style.jpg`)).toBe(
      `${dir}/3040643000_01.jpg`
    )
    expect(getCharacterBaseArtUrl(`${dir}/3040643000_01_1.jpg`)).toBe(
      `${dir}/3040643000_01.jpg`
    )
  })

  it('is null when the URL is already the base art', () => {
    expect(getCharacterBaseArtUrl(`${dir}/3040643000_01.jpg`)).toBeNull()
  })
})

describe('toHenseiElement', () => {
  it("maps the game's element IDs to Hensei's", () => {
    expect(toHenseiElement('1')).toBe(2) // Fire
    expect(toHenseiElement(2)).toBe(3) // Water
    expect(toHenseiElement('3')).toBe(4) // Earth
    expect(toHenseiElement('4')).toBe(1) // Wind
    expect(toHenseiElement('5')).toBe(6) // Light
    expect(toHenseiElement('6')).toBe(5) // Dark
  })

  it('is null for no element or an unknown one', () => {
    expect(toHenseiElement(undefined)).toBeNull()
    expect(toHenseiElement('0')).toBeNull()
  })
})

describe('getCharacterArtFallbacks', () => {
  const dir = 'https://siero-img.s3-us-west-2.amazonaws.com/characters/main'

  it("tries the party element's art before the base art", () => {
    expect(getCharacterArtFallbacks(`${dir}/3030182000_03.jpg`, 2)).toEqual([
      `${dir}/3030182000_03_02.jpg`,
      `${dir}/3030182000_01_02.jpg`,
      `${dir}/3030182000_01.jpg`
    ])
  })

  it('skips the URL that just failed', () => {
    expect(getCharacterArtFallbacks(`${dir}/3030182000_01.jpg`, 5)).toEqual([
      `${dir}/3030182000_01_05.jpg`
    ])
  })

  it('falls back to the base art without a party element', () => {
    expect(getCharacterArtFallbacks(`${dir}/3040643000_03.jpg`)).toEqual([
      `${dir}/3040643000_01.jpg`
    ])
    expect(getCharacterArtFallbacks(`${dir}/3040643000_01.jpg`)).toEqual([])
  })
})

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
