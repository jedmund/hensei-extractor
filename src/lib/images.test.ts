import { describe, expect, it } from 'vitest'
import {
  getCharacterArtFallbacks,
  getCharacterBaseArtUrl,
  getElementIconUrl,
  partyElementKey,
  getImageIdSuffix,
  getPlaceholderImageUrl,
  getSummonImageUrl
} from './images.js'
import { gameElementKey } from './game-data.js'

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

describe('gameElementKey', () => {
  it("names the game's element IDs", () => {
    expect(gameElementKey('1')).toBe('fire')
    expect(gameElementKey(2)).toBe('water')
    expect(gameElementKey('3')).toBe('earth')
    expect(gameElementKey('4')).toBe('wind')
    expect(gameElementKey('5')).toBe('light')
    expect(gameElementKey('6')).toBe('dark')
  })

  it('is null for no element or an unknown one', () => {
    expect(gameElementKey(undefined)).toBeNull()
    expect(gameElementKey('0')).toBeNull()
  })
})

describe('getCharacterArtFallbacks', () => {
  const dir = 'https://siero-img.s3-us-west-2.amazonaws.com/characters/main'

  it("tries the party element's art before the base art", () => {
    expect(getCharacterArtFallbacks(`${dir}/3030182000_03.jpg`, 2)).toEqual([
      `${dir}/3030182000_03_02.jpg?ids=game`,
      `${dir}/3030182000_01_02.jpg?ids=game`,
      `${dir}/3030182000_01.jpg`
    ])
  })

  it('skips the URL that just failed', () => {
    expect(getCharacterArtFallbacks(`${dir}/3030182000_01.jpg`, 5)).toEqual([
      `${dir}/3030182000_01_05.jpg?ids=game`
    ])
  })

  it('steps down from element art that already carries the query', () => {
    expect(
      getCharacterArtFallbacks(`${dir}/3030182000_03_02.jpg?ids=game`, 2)
    ).toEqual([
      `${dir}/3030182000_01_02.jpg?ids=game`,
      `${dir}/3030182000_01.jpg`
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

describe('partyElementKey', () => {
  it("reads the main-hand weapon's element", () => {
    const party = {
      deck: { pc: { weapons: { 1: { master: { attribute: '4' } }, 2: null } } }
    }
    expect(partyElementKey(party)).toBe('wind')
  })

  it('is null without a main hand or an element', () => {
    expect(
      partyElementKey({ deck: { pc: { weapons: { 1: null } } } })
    ).toBeNull()
    expect(
      partyElementKey({ deck: { pc: { weapons: { 1: { master: {} } } } } })
    ).toBeNull()
    expect(partyElementKey(null)).toBeNull()
  })
})
