import { describe, expect, it } from 'vitest'
import {
  extractGbfUserIdFromUrl,
  parseSupportSummons
} from './support-summons.js'

// Fixtures follow the markup documented in support-summons.ts. Replace them
// with trimmed real captures when available.
const URL = 'https://game.granbluefantasy.jp/profile/content/index/12345678?_=1'

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
          level: 100,
          name: 'Bahamut'
        },
        {
          gbf_section: 1,
          position: 0,
          granblue_id: '2040094000',
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

  it('flags another player’s profile, which has no edit markup', () => {
    const html =
      '<div class="prt-summon" data-masterid="2040094000"></div>' +
      '<div class="prt-summon-name">Lvl 250 Agni</div>'

    expect(parseSupportSummons(envelope(html), URL)).toEqual({
      gbf_user_id: '12345678',
      is_own_profile: false,
      items: []
    })
  })

  it.each([
    ['a missing envelope', null],
    ['an empty payload', { data: '' }],
    ['malformed URI encoding', { data: '%E0%A4%A' }]
  ])('returns no items for %s', (_label, raw) => {
    expect(parseSupportSummons(raw, URL)).toEqual({
      gbf_user_id: '12345678',
      is_own_profile: false,
      items: []
    })
  })
})

describe('extractGbfUserIdFromUrl', () => {
  it('returns null for unrelated URLs', () => {
    expect(
      extractGbfUserIdFromUrl('https://game.granbluefantasy.jp/profile')
    ).toBeNull()
  })
})
