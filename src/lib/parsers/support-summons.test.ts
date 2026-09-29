import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  extractGbfUserIdFromUrl,
  extractViewerIdFromUrl,
  parseSupportSummons
} from './support-summons.js'

// Fixtures follow the markup documented in support-summons.ts. Replace them
// with trimmed real captures when available.
// GBF appends the logged-in player's ID as `uid` to its XHRs.
const URL =
  'https://game.granbluefantasy.jp/profile/content/index/12345678?_=1&t=2&uid=12345678'
const FOREIGN_URL =
  'https://game.granbluefantasy.jp/profile/content/index/87654321?_=1&t=2&uid=12345678'

function envelope(html: string) {
  return { data: encodeURIComponent(html) }
}

function slot(section: number, position: number, id: string, label: string) {
  return (
    `<div class="prt-fix-summon" id="js-fix-summon${section}${position}" data-masterid="${id}" data-quality="99">` +
    `<img src="x.jpg"></div>` +
    `<div class="prt-fix-name" id="js-fix-summon${section}${position}-name">${label}</div>`
  )
}

function emptySlot(section: number, position: number) {
  return `<a class="btn-fix-summon" href="#profile/fix/list/summon/${section}/${position}"></a>`
}

const REAL_OWN_PROFILE = readFileSync(
  new globalThis.URL(
    './__fixtures__/support-summons-own-profile.html',
    import.meta.url
  ),
  'utf8'
)
// The real request URL for that capture: path ID and uid are both the player's.
const REAL_URL =
  'https://game.granbluefantasy.jp/profile/content/index/11675274?_=1790657107623&t=1790657108016&uid=11675274'

describe('parseSupportSummons on a real capture', () => {
  it('reads every populated slot and skips the empty one', () => {
    expect(parseSupportSummons(envelope(REAL_OWN_PROFILE), REAL_URL)).toEqual({
      gbf_user_id: '11675274',
      is_own_profile: true,
      items: [
        {
          gbf_section: 0,
          position: 0,
          granblue_id: '2040158000',
          image_id: '2040158000',
          level: 100,
          name: 'Qilin'
        },
        {
          gbf_section: 0,
          position: 1,
          granblue_id: '2040157000',
          image_id: '2040157000',
          level: 100,
          name: 'Huanglong'
        },
        {
          gbf_section: 0,
          position: 2,
          granblue_id: '2040065000',
          image_id: '2040065000_02',
          level: 200,
          name: 'Grand Order'
        },
        {
          gbf_section: 1,
          position: 0,
          granblue_id: '2040094000',
          image_id: '2040094000_04',
          level: 250,
          name: 'Agni'
        }
      ]
    })
  })

  it('is not own when the same page is fetched for another player', () => {
    const foreign = REAL_URL.replace('index/11675274', 'index/34905928')

    expect(
      parseSupportSummons(envelope(REAL_OWN_PROFILE), foreign).is_own_profile
    ).toBe(false)
  })
})

describe('parseSupportSummons', () => {
  it('reads populated slots from the own-profile page, sorted by section', () => {
    const html =
      slot(1, 0, '2040094000', 'Lvl 250 Agni') +
      emptySlot(1, 1) +
      slot(0, 0, '2040158000', 'Lvl 100 Bahamut')

    expect(parseSupportSummons(envelope(html), URL)).toEqual({
      gbf_user_id: '12345678',
      is_own_profile: true,
      items: [
        {
          gbf_section: 0,
          position: 0,
          granblue_id: '2040158000',
          image_id: '2040158000',
          level: 100,
          name: 'Bahamut'
        },
        {
          gbf_section: 1,
          position: 0,
          granblue_id: '2040094000',
          image_id: '2040094000',
          level: 250,
          name: 'Agni'
        }
      ]
    })
  })

  it('reads the JP client "Lv" label', () => {
    const html = slot(2, 1, '2040020000', 'Lv 150 ヴァルナ')

    expect(parseSupportSummons(envelope(html), URL).items[0]).toMatchObject({
      level: 150,
      name: 'ヴァルナ'
    })
  })

  it('does not depend on attribute order', () => {
    const html =
      '<div data-masterid="2040094000" class="x" id="js-fix-summon30"></div>' +
      '<div id="js-fix-summon30-name">Lvl 200 Titan</div>'

    expect(parseSupportSummons(envelope(html), URL).items).toEqual([
      {
        gbf_section: 3,
        position: 0,
        granblue_id: '2040094000',
        image_id: '2040094000',
        level: 200,
        name: 'Titan'
      }
    ])
  })

  it('leaves level null rather than 0 when the label is missing', () => {
    const html =
      '<div id="js-fix-summon40" data-masterid="2040094000"></div>' +
      '<div id="js-fix-summon40-name"><span>150</span></div>'

    expect(parseSupportSummons(envelope(html), URL).items[0]).toMatchObject({
      level: null,
      name: null
    })
  })

  it('treats an all-empty own profile as own with no items', () => {
    const html = emptySlot(0, 0) + emptySlot(1, 0)

    expect(parseSupportSummons(envelope(html), URL)).toMatchObject({
      is_own_profile: true,
      items: []
    })
  })

  it('flags another player’s profile even though it has the same slot markup', () => {
    const html = slot(1, 0, '2040094000', 'Lvl 250 Agni')

    expect(parseSupportSummons(envelope(html), FOREIGN_URL)).toMatchObject({
      gbf_user_id: '87654321',
      is_own_profile: false
    })
  })

  it('treats a request without uid as not the player’s own', () => {
    const html = slot(1, 0, '2040094000', 'Lvl 250 Agni')
    const noUid =
      'https://game.granbluefantasy.jp/profile/content/index/12345678?_=1'

    expect(parseSupportSummons(envelope(html), noUid).is_own_profile).toBe(
      false
    )
  })

  it('treats an own-profile request without an ID in the path as own', () => {
    const url =
      'https://game.granbluefantasy.jp/profile/content/index?uid=12345678'

    expect(
      parseSupportSummons(envelope(slot(0, 0, '1', 'Lv 1 X')), url)
    ).toMatchObject({
      gbf_user_id: '12345678',
      is_own_profile: true
    })
  })

  it.each([
    ['a missing envelope', null],
    ['an empty payload', { data: '' }],
    ['malformed URI encoding', { data: '%E0%A4%A' }]
  ])('returns no items for %s', (_label, raw) => {
    expect(parseSupportSummons(raw, URL).items).toEqual([])
  })
})

describe('extractViewerIdFromUrl', () => {
  it('reads the uid param', () => {
    expect(extractViewerIdFromUrl(URL)).toBe('12345678')
  })

  it('returns null when uid is missing or not numeric', () => {
    expect(
      extractViewerIdFromUrl('https://game.granbluefantasy.jp/x?uid=')
    ).toBeNull()
    expect(
      extractViewerIdFromUrl('https://game.granbluefantasy.jp/x?uid=abc')
    ).toBeNull()
    expect(extractViewerIdFromUrl('not a url')).toBeNull()
  })
})

describe('extractGbfUserIdFromUrl', () => {
  it('returns null for unrelated URLs', () => {
    expect(
      extractGbfUserIdFromUrl('https://game.granbluefantasy.jp/profile')
    ).toBeNull()
  })
})
