import { describe, expect, it } from 'vitest'
import {
  buildInterceptMetadata,
  DATA_TYPE_RULES,
  GBF_DOMAINS,
  getDataType,
  getEventNumber,
  getMasterId,
  getPageNumber,
  getPartyId,
  getStashNumber,
  getUnfPageNumber,
  INTERCEPT_PATTERNS,
  isGameUrl,
  isStashContentUrl,
  matchesPageContext,
  parseStashName,
  requiresPageContext,
  shouldIntercept
} from './intercept-routes.js'

// The game appends a cache-buster, a timestamp and the user id to every
// request, so every realistic URL here carries a query string.
const QUERY = '?_=1700000000000&t=1700000000123&uid=12345678'

function gbf(path: string, domain = 'game.granbluefantasy.jp'): string {
  return `https://${domain}${path}${QUERY}`
}

// Every data type getDataType can return, with a path the game requests.
const ROUTES: ReadonlyArray<readonly [dataType: string, path: string]> = [
  ['party', '/party/deck/1/3'],
  ['detail_npc', '/archive/npc_detail'],
  ['detail_weapon', '/archive/weapon_detail'],
  ['detail_summon', '/archive/summon_detail'],
  ['character_detail', '/npc/npc/987654321'],
  ['zenith_npc', '/npczenith/bonus_list/3040036000'],
  ['zenith_npc', '/npczenith/content/index/3040036000'],
  ['stash_weapon', '/weapon/container_list/1/3'],
  ['stash_summon', '/summon/container_list/2/5'],
  ['collection_weapon', '/rest/weapon/list/1/0'],
  ['collection_npc', '/rest/npc/list/1/0'],
  ['collection_summon', '/rest/summon/list/1/0'],
  ['collection_artifact', '/rest/artifact/list/1/0'],
  ['list_npc', '/npc/list/2/0'],
  ['list_weapon', '/weapon/list/2/0'],
  ['list_summon', '/summon/list/2/0'],
  ['unf_scores', '/teamraid072/rest/performance//total_performance/1'],
  ['unf_daily_scores', '/teamraid072/rest/performance//todays_performance/1'],
  ['guild_info', '/rest/guild/main/guild_info'],
  ['support_summons', '/profile/content/index/12345678']
]

describe('getDataType', () => {
  describe.each(GBF_DOMAINS)('on %s', (domain) => {
    it.each(ROUTES)('classifies %s from %s', (dataType, path) => {
      expect(getDataType(gbf(path, domain))).toBe(dataType)
    })
  })

  it('returns unknown for intercepted URLs without a data type', () => {
    // Stash content pages are intercepted only to read the stash name.
    expect(getDataType(gbf('/container/content/list/1'))).toBe('unknown')
    expect(getDataType(gbf('/quest/content/index'))).toBe('unknown')
    expect(getDataType('')).toBe('unknown')
  })

  describe('order-sensitive patterns', () => {
    it('matches /rest/*/list/ collections before plain /*/list/ pages', () => {
      // '/rest/weapon/list/' contains '/weapon/list/', and so on.
      expect(getDataType(gbf('/rest/weapon/list/1/0'))).toBe(
        'collection_weapon'
      )
      expect(getDataType(gbf('/rest/npc/list/1/0'))).toBe('collection_npc')
      expect(getDataType(gbf('/rest/summon/list/1/0'))).toBe(
        'collection_summon'
      )
      expect(getDataType(gbf('/weapon/list/1/0'))).toBe('list_weapon')
      expect(getDataType(gbf('/npc/list/1/0'))).toBe('list_npc')
      expect(getDataType(gbf('/summon/list/1/0'))).toBe('list_summon')
    })

    it('keeps zenith pages apart from the other npc pages', () => {
      expect(getDataType(gbf('/npczenith/bonus_list/3040036000'))).toBe(
        'zenith_npc'
      )
      expect(getDataType(gbf('/npczenith/content/index/3040036000'))).toBe(
        'zenith_npc'
      )
      expect(getDataType(gbf('/npc/npc/987654321'))).toBe('character_detail')
      expect(getDataType(gbf('/npc/list/1/0'))).toBe('list_npc')
      // A character page wins over a zenith page when both appear.
      expect(
        getDataType(gbf('/npc/npc/987654321/npczenith/bonus_list/3040036000'))
      ).toBe('character_detail')
    })

    it('reads container_list as a stash, never as a list page', () => {
      expect(getDataType(gbf('/weapon/container_list/1/3'))).toBe(
        'stash_weapon'
      )
      expect(getDataType(gbf('/summon/container_list/1/3'))).toBe(
        'stash_summon'
      )
      // A stash wins over a list when a URL somehow contains both.
      expect(getDataType(gbf('/weapon/container_list/1/3/weapon/list/1'))).toBe(
        'stash_weapon'
      )
    })

    it('tells total and todays performance apart', () => {
      expect(
        getDataType(gbf('/teamraid072/rest/performance//total_performance/1'))
      ).toBe('unf_scores')
      expect(
        getDataType(gbf('/teamraid072/rest/performance//todays_performance/1'))
      ).toBe('unf_daily_scores')
      expect(
        getDataType(
          gbf('/teamraid072/todays_performance/1/total_performance/1')
        )
      ).toBe('unf_scores')
    })

    it('needs a teamraid segment for performance pages', () => {
      expect(getDataType(gbf('/rest/performance//total_performance/1'))).toBe(
        'unknown'
      )
      expect(getDataType(gbf('/rest/performance//todays_performance/1'))).toBe(
        'unknown'
      )
      // '/teamraid' anywhere in the URL is enough, even after the pattern.
      expect(getDataType(gbf('/total_performance/1/teamraid'))).toBe(
        'unf_scores'
      )
    })

    it('puts party decks ahead of everything else', () => {
      expect(getDataType(gbf('/party/deck/1/3/weapon/list/1'))).toBe('party')
    })

    it('matches patterns in the path only, not the query', () => {
      expect(
        getDataType('https://game.granbluefantasy.jp/quest?next=/party/deck')
      ).toBe('unknown')
    })
  })
})

describe('shouldIntercept', () => {
  it.each(ROUTES)('intercepts %s pages (%s)', (_dataType, path) => {
    for (const domain of GBF_DOMAINS) {
      expect(shouldIntercept(gbf(path, domain))).toBe(true)
    }
  })

  it('intercepts stash content pages for their names', () => {
    expect(shouldIntercept(gbf('/container/content/list/1'))).toBe(true)
  })

  it('ignores GBF pages that are not captured', () => {
    expect(shouldIntercept(gbf('/quest/content/index'))).toBe(false)
    expect(shouldIntercept(gbf('/rest/sound/mypage_voice'))).toBe(false)
    expect(shouldIntercept('https://game.granbluefantasy.jp/')).toBe(false)
  })

  it('ignores empty URLs', () => {
    expect(shouldIntercept('')).toBe(false)
  })

  it('ignores non-GBF URLs without a captured path', () => {
    expect(shouldIntercept('https://example.com/')).toBe(false)
    expect(shouldIntercept('https://granblue.team/teams')).toBe(false)
  })

  describe('only reads game hosts over https', () => {
    it.each([
      'https://example.com/party/deck/1/3',
      'https://game.granbluefantasy.jp.example.com/party/deck/1/3',
      'https://example.com/game.granbluefantasy.jp/party/deck/1/3',
      'https://example.com/?u=https://game.granbluefantasy.jp/rest/weapon/list/1/0',
      'http://game.granbluefantasy.jp/party/deck/1/3',
      'not a url /party/deck'
    ])('ignores %s', (url) => {
      expect(shouldIntercept(url)).toBe(false)
    })

    it('ignores a captured path that only appears in the query', () => {
      expect(
        shouldIntercept(
          'https://game.granbluefantasy.jp/quest?next=/party/deck'
        )
      ).toBe(false)
    })
  })
})

describe('isGameUrl', () => {
  it.each([
    ['https://game.granbluefantasy.jp/#mypage', true],
    ['https://gbf.game.mbga.jp/#party/index/0/npc/0', true],
    ['https://steam.granbluefantasy.com/', true],
    ['https://www.google.com/search?q=game.granbluefantasy.jp', false],
    ['https://game.granbluefantasy.jp.example.com/', false],
    ['http://game.granbluefantasy.jp/', false],
    ['chrome://newtab/', false],
    [undefined, false]
  ])('%s → %s', (url, expected) => {
    expect(isGameUrl(url)).toBe(expected)
  })
})

describe('getPageNumber', () => {
  it('reads the page after /list/', () => {
    expect(getPageNumber(gbf('/npc/list/2/0'))).toBe(2)
    expect(getPageNumber(gbf('/rest/weapon/list/15/0'))).toBe(15)
    expect(getPageNumber(gbf('/summon/list/007/0'))).toBe(7)
  })

  it('returns null when there is no numeric page', () => {
    expect(getPageNumber(gbf('/party/deck/1/3'))).toBeNull()
    expect(getPageNumber(gbf('/npc/list/'))).toBeNull()
    expect(getPageNumber(gbf('/npc/list/abc'))).toBeNull()
    expect(getPageNumber('')).toBeNull()
  })

  it('does not read stash URLs, which have no /list/ segment', () => {
    expect(getPageNumber(gbf('/weapon/container_list/1/3'))).toBeNull()
  })
})

describe('getStashNumber', () => {
  it('reads the stash number after the page', () => {
    expect(getStashNumber(gbf('/weapon/container_list/1/3'))).toBe('3')
    expect(getStashNumber(gbf('/summon/container_list/2/12'))).toBe('12')
  })

  it('falls back to stash 1', () => {
    expect(getStashNumber(gbf('/weapon/container_list/1'))).toBe('1')
    expect(getStashNumber(gbf('/weapon/container_list/1/x'))).toBe('1')
    expect(getStashNumber(gbf('/weapon/container_list/'))).toBe('1')
    expect(getStashNumber(gbf('/npc/container_list/1/3'))).toBe('1')
  })
})

describe('getPartyId', () => {
  it('prefers the group and slot from the URL', () => {
    expect(
      getPartyId(gbf('/party/deck/1/3'), { deck: { priority: 2, name: 'x' } })
    ).toBe('1_3')
  })

  it('falls back to the deck priority, including 0', () => {
    expect(getPartyId(gbf('/party/deck'), { deck: { priority: 4 } })).toBe(
      'deck_4'
    )
    expect(getPartyId(gbf('/party/deck'), { deck: { priority: 0 } })).toBe(
      'deck_0'
    )
  })

  it('then falls back to a sanitised, truncated deck name', () => {
    expect(
      getPartyId(gbf('/party/deck'), {
        deck: { name: 'Wind Grid (Full Auto)' }
      })
    ).toBe('wind_grid__full_auto')
    expect(getPartyId(gbf('/party/deck'), { deck: { name: '風パ' } })).toBe(
      '__'
    )
  })

  it('returns null without a URL match or usable deck', () => {
    expect(getPartyId(gbf('/party/deck'), { deck: { name: '' } })).toBeNull()
    expect(getPartyId(gbf('/party/deck'), { deck: {} })).toBeNull()
    expect(getPartyId(gbf('/party/deck'), {})).toBeNull()
    expect(getPartyId(gbf('/party/deck'), null)).toBeNull()
    expect(getPartyId(gbf('/party/deck/1'), undefined)).toBeNull()
  })
})

describe('getMasterId', () => {
  it('reads zenith master ids from the URL', () => {
    expect(
      getMasterId(gbf('/npczenith/bonus_list/3040036000'), {}, 'zenith_npc')
    ).toBe('3040036000')
    expect(
      getMasterId(gbf('/npczenith/content/index/3040036000'), {}, 'zenith_npc')
    ).toBe('3040036000')
    expect(
      getMasterId(gbf('/npczenith/bonus_list/'), {}, 'zenith_npc')
    ).toBeNull()
  })

  it('reads character detail master ids from the body', () => {
    expect(
      getMasterId(
        gbf('/npc/npc/987654321'),
        { master: { id: '3040036000' } },
        'character_detail'
      )
    ).toBe('3040036000')
    expect(
      getMasterId(gbf('/npc/npc/987654321'), { master: {} }, 'character_detail')
    ).toBeNull()
    expect(
      getMasterId(gbf('/npc/npc/987654321'), null, 'character_detail')
    ).toBeNull()
  })

  it('returns null for every other data type', () => {
    expect(
      getMasterId(
        gbf('/npczenith/bonus_list/3040036000'),
        { master: { id: '3040036000' } },
        'list_npc'
      )
    ).toBeNull()
  })
})

describe('getEventNumber', () => {
  it('reads the event number and strips leading zeros', () => {
    expect(
      getEventNumber(gbf('/teamraid072/rest/performance//total_performance/1'))
    ).toBe(72)
    expect(getEventNumber(gbf('/teamraid100/top'))).toBe(100)
  })

  it('needs a slash after the number', () => {
    expect(
      getEventNumber('https://game.granbluefantasy.jp/teamraid072')
    ).toBeNull()
    expect(getEventNumber(gbf('/teamraid072'))).toBeNull()
  })

  it('returns null for URLs without a teamraid segment', () => {
    expect(
      getEventNumber(gbf('/rest/performance//total_performance/1'))
    ).toBeNull()
    expect(getEventNumber(gbf('/teamraid/total_performance/1'))).toBeNull()
  })
})

describe('getUnfPageNumber', () => {
  it('reads the page after the performance segment', () => {
    expect(
      getUnfPageNumber(
        gbf('/teamraid072/rest/performance//total_performance/3')
      )
    ).toBe(3)
    expect(
      getUnfPageNumber(
        gbf('/teamraid072/rest/performance//todays_performance/12')
      )
    ).toBe(12)
  })

  it('returns null when the page is missing or malformed', () => {
    expect(
      getUnfPageNumber(gbf('/teamraid072/rest/performance//total_performance/'))
    ).toBeNull()
    expect(
      getUnfPageNumber(gbf('/teamraid072/total_performance//3'))
    ).toBeNull()
    expect(getUnfPageNumber(gbf('/teamraid072/total_performance/x'))).toBeNull()
  })
})

describe('DATA_TYPE_RULES', () => {
  // Rules are tried in order, so a rule whose patterns contain a later
  // rule's patterns must come first. Building a URL from each rule's own
  // patterns catches any rule that an earlier one would swallow.
  it.each(DATA_TYPE_RULES.map((rule, index) => [index, rule] as const))(
    'rule %i (%o) is not shadowed by an earlier rule',
    (_index, rule) => {
      expect(getDataType(gbf(rule.includes.join('')))).toBe(rule.dataType)
    }
  )

  it('covers every data type in the route fixtures', () => {
    const ruleTypes = new Set(DATA_TYPE_RULES.map((rule) => rule.dataType))
    const routeTypes = new Set(ROUTES.map(([dataType]) => dataType))
    expect(routeTypes).toEqual(ruleTypes)
  })

  it('only classifies URLs that are intercepted', () => {
    for (const rule of DATA_TYPE_RULES) {
      expect(INTERCEPT_PATTERNS).toContain(rule.includes[0])
    }
  })
})

describe('isStashContentUrl', () => {
  it('recognises stash content pages only', () => {
    expect(isStashContentUrl(gbf('/container/content/list/3'))).toBe(true)
    expect(isStashContentUrl(gbf('/weapon/container_list/1/3'))).toBe(false)
  })
})

describe('parseStashName', () => {
  function encoded(html: string): { data: string } {
    return { data: encodeURIComponent(html) }
  }

  it('reads and trims the name from the encoded HTML', () => {
    expect(
      parseStashName(
        encoded('<div class="prt-container-name">  Grid Weapons </div>')
      )
    ).toBe('Grid Weapons')
    expect(
      parseStashName(encoded('<div class="prt-container-name">倉庫 2</div>'))
    ).toBe('倉庫 2')
  })

  it('returns a blank name as an empty string', () => {
    expect(
      parseStashName(encoded('<div class="prt-container-name">   </div>'))
    ).toBe('')
  })

  it('returns null without a name', () => {
    expect(parseStashName(encoded('<div class="prt-container"></div>'))).toBe(
      null
    )
    expect(
      parseStashName(encoded('<div class="prt-container-name"></div>'))
    ).toBeNull()
    expect(parseStashName({ data: '' })).toBeNull()
    expect(parseStashName({})).toBeNull()
    expect(parseStashName(null as unknown as { data?: string })).toBeNull()
  })

  it('throws on HTML that is not valid URI encoding', () => {
    expect(() => parseStashName({ data: '%E0%A4%A' })).toThrow(URIError)
  })
})

describe('page context', () => {
  it('only constrains guild info and UNF scores', () => {
    expect(requiresPageContext('guild_info')).toBe(true)
    expect(requiresPageContext('unf_scores')).toBe(true)
    expect(requiresPageContext('unf_daily_scores')).toBe(true)
    for (const [dataType] of ROUTES) {
      if (!['guild_info', 'unf_scores', 'unf_daily_scores'].includes(dataType))
        expect(requiresPageContext(dataType)).toBe(false)
    }
    expect(requiresPageContext('unknown')).toBe(false)
  })

  it('checks the tab hash', () => {
    const game = 'https://game.granbluefantasy.jp/'
    expect(matchesPageContext('guild_info', `${game}#guild/detail/1`)).toBe(
      true
    )
    expect(matchesPageContext('guild_info', `${game}#mypage`)).toBe(false)
    expect(
      matchesPageContext('unf_scores', `${game}#event/teamraid072/performance`)
    ).toBe(true)
    expect(
      matchesPageContext('unf_daily_scores', `${game}#event/teamraid072`)
    ).toBe(true)
    expect(matchesPageContext('unf_scores', `${game}#event/other`)).toBe(false)
  })

  it('rejects missing or unparseable tab URLs', () => {
    expect(matchesPageContext('guild_info', undefined)).toBe(false)
    expect(matchesPageContext('guild_info', 'not a url')).toBe(false)
  })

  it('accepts any tab for unconstrained data types', () => {
    expect(matchesPageContext('party', undefined)).toBe(true)
  })
})

describe('buildInterceptMetadata', () => {
  const empty = {
    pageNumber: null,
    partyId: null,
    masterId: null,
    stashNumber: null,
    stashName: null,
    eventNumber: null
  }

  it('builds party metadata', () => {
    expect(
      buildInterceptMetadata(gbf('/party/deck/1/3'), {}, 'party', 'Stash')
    ).toEqual({ ...empty, partyId: '1_3' })
  })

  it('builds list metadata with the URL page number', () => {
    expect(
      buildInterceptMetadata(gbf('/npc/list/2/0'), {}, 'list_npc', 'Stash')
    ).toEqual({ ...empty, pageNumber: 2 })
  })

  it('builds stash metadata from the body page and the stash name', () => {
    const url = gbf('/weapon/container_list/1/3')
    expect(
      buildInterceptMetadata(url, { current: 4 }, 'stash_weapon', 'Stash')
    ).toEqual({
      ...empty,
      pageNumber: 4,
      stashNumber: '3',
      stashName: 'Stash'
    })
    expect(buildInterceptMetadata(url, null, 'stash_weapon', null)).toEqual({
      ...empty,
      pageNumber: 1,
      stashNumber: '3'
    })
  })

  it('builds UNF metadata from the performance page and event', () => {
    const url = gbf('/teamraid072/rest/performance//todays_performance/2')
    expect(buildInterceptMetadata(url, {}, 'unf_daily_scores', null)).toEqual({
      ...empty,
      pageNumber: 2,
      eventNumber: 72
    })
  })

  it('builds character metadata with master ids', () => {
    expect(
      buildInterceptMetadata(
        gbf('/npczenith/content/index/3040036000'),
        {},
        'zenith_npc',
        null
      )
    ).toEqual({ ...empty, masterId: '3040036000' })
    expect(
      buildInterceptMetadata(
        gbf('/npc/npc/987654321'),
        { master: { id: '3040036000' } },
        'character_detail',
        null
      )
    ).toEqual({ ...empty, masterId: '3040036000' })
  })
})
