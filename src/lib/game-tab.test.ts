import { describe, expect, it } from 'vitest'
import { gamePageUrl, pickGameTab } from './game-tab.js'

describe('pickGameTab', () => {
  it('prefers the active game tab', () => {
    const tabs = [
      {
        id: 1,
        url: 'https://game.granbluefantasy.jp/#mypage',
        lastAccessed: 50
      },
      {
        id: 2,
        url: 'https://game.granbluefantasy.jp/#quest',
        active: true,
        lastAccessed: 10
      }
    ]
    expect(pickGameTab(tabs)?.id).toBe(2)
  })

  it('otherwise uses the most recently used game tab', () => {
    const tabs = [
      {
        id: 1,
        url: 'https://game.granbluefantasy.jp/#mypage',
        lastAccessed: 10
      },
      { id: 2, url: 'https://gbf.game.mbga.jp/#quest', lastAccessed: 30 },
      { id: 3, url: 'https://granblue.team/', active: true, lastAccessed: 99 }
    ]
    expect(pickGameTab(tabs)?.id).toBe(2)
  })

  it('returns null without a game tab', () => {
    expect(pickGameTab([{ id: 1, url: 'https://example.com/' }])).toBeNull()
    expect(
      pickGameTab([{ url: 'https://game.granbluefantasy.jp/' }])
    ).toBeNull()
  })
})

describe('gamePageUrl', () => {
  it("stays on the tab's game host and drops its path and query", () => {
    expect(
      gamePageUrl(
        'https://gbf.game.mbga.jp/?uid=123#mypage',
        '#arcarum3/dungeon_report_book/id=1'
      )
    ).toBe('https://gbf.game.mbga.jp/#arcarum3/dungeon_report_book/id=1')
  })

  it('uses the main game host for a new tab', () => {
    expect(gamePageUrl(undefined, 'arcarum3/dungeon_report_detail/id=1')).toBe(
      'https://game.granbluefantasy.jp/#arcarum3/dungeon_report_detail/id=1'
    )
    expect(gamePageUrl('https://example.com/', '#mypage')).toBe(
      'https://game.granbluefantasy.jp/#mypage'
    )
  })
})
