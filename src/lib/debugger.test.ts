import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DebuggerModule from './debugger.js'

const QUERY = '?_=1700000000000&t=1700000000123&uid=12345678'
const GAME = 'https://game.granbluefantasy.jp'

type EventListener = (
  source: chrome.debugger.Debuggee,
  method: string,
  params?: unknown
) => void

type TabUpdatedListener = (
  tabId: number,
  changeInfo: { status?: string; url?: string },
  tab: { id: number; url?: string }
) => void

interface Harness {
  intercepted: ReturnType<typeof vi.fn>
  getResponseBody: ReturnType<typeof vi.fn>
  attach: ReturnType<typeof vi.fn>
  detach: ReturnType<typeof vi.fn>
  /** Fires chrome.tabs.onUpdated for the test tab. */
  updateTab: (
    changeInfo: { status?: string; url?: string },
    url: string
  ) => Promise<void>
  setTabUrl: (url: string | undefined) => void
  failTabLookup: () => void
  respond: (
    url: string,
    body: unknown,
    options?: { raw?: string; base64?: boolean }
  ) => Promise<void>
}

const TAB_ID = 7

// Drives debugger.ts through stubbed chrome.debugger events, so the whole
// path from a response to the capture callback is covered.
async function setup(): Promise<Harness> {
  vi.resetModules()

  let eventListener: EventListener | null = null
  let tabUpdatedListener: TabUpdatedListener | null = null
  let tabUrl: string | undefined = `${GAME}/#mypage`
  let tabLookupFails = false
  const bodies = new Map<string, { body: string; base64Encoded: boolean }>()
  let nextRequestId = 0

  const getResponseBody = vi.fn()
  const attach = vi.fn(async () => {})
  const detach = vi.fn(async () => {})
  const noopEvent = { addListener: vi.fn() }

  vi.stubGlobal('chrome', {
    debugger: {
      onEvent: {
        addListener: (listener: EventListener) => {
          eventListener = listener
        }
      },
      onDetach: noopEvent,
      attach,
      detach,
      sendCommand: vi.fn(
        async (
          _target: unknown,
          method: string,
          params?: { requestId: string }
        ) => {
          if (method !== 'Network.getResponseBody') return undefined
          getResponseBody(params!.requestId)
          return bodies.get(params!.requestId)
        }
      )
    },
    tabs: {
      onUpdated: {
        addListener: (listener: TabUpdatedListener) => {
          tabUpdatedListener = listener
        }
      },
      onRemoved: noopEvent,
      query: vi.fn(async () => []),
      get: vi.fn(async () => {
        if (tabLookupFails) throw new Error('No tab with id')
        return { id: TAB_ID, url: tabUrl }
      })
    }
  })

  const debuggerModule: typeof DebuggerModule = await import('./debugger.js')
  const intercepted = vi.fn()
  debuggerModule.initDebugger(intercepted)

  return {
    intercepted,
    getResponseBody,
    attach,
    detach,
    updateTab: async (changeInfo, url) => {
      tabUpdatedListener!(TAB_ID, changeInfo, { id: TAB_ID, url })
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
    setTabUrl: (url) => {
      tabUrl = url
    },
    failTabLookup: () => {
      tabLookupFails = true
    },
    respond: async (url, body, options = {}) => {
      const requestId = String(++nextRequestId)
      const text = options.raw ?? JSON.stringify(body)
      bodies.set(requestId, {
        body: options.base64 ? btoa(text) : text,
        base64Encoded: options.base64 ?? false
      })
      const source = { tabId: TAB_ID }
      eventListener!(source, 'Network.responseReceived', {
        requestId,
        response: { url }
      })
      eventListener!(source, 'Network.loadingFinished', { requestId })
      // Let the body fetch and page-context lookup settle.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

const EMPTY_METADATA = {
  pageNumber: null,
  partyId: null,
  masterId: null,
  stashNumber: null,
  stashName: null,
  eventNumber: null
}

function stashNameResponse(name: string): { data: string } {
  return {
    data: encodeURIComponent(
      `<div class="prt-container"><div class="prt-container-name">${name}</div></div>`
    )
  }
}

describe('debugger capture pipeline', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await setup()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('delivers parties with their id from the URL', async () => {
    const url = `${GAME}/party/deck/1/3${QUERY}`
    const data = { deck: { name: 'Wind', priority: 2 } }

    await harness.respond(url, data)

    expect(harness.intercepted).toHaveBeenCalledWith(
      url,
      data,
      'party',
      { ...EMPTY_METADATA, partyId: '1_3' },
      expect.any(Number)
    )
  })

  it('delivers list and collection pages with their page number', async () => {
    await harness.respond(`${GAME}/npc/list/2/0${QUERY}`, { list: [] })
    await harness.respond(`${GAME}/rest/weapon/list/5/0${QUERY}`, { list: [] })

    expect(
      harness.intercepted.mock.calls.map((call) => call.slice(2, 4))
    ).toEqual([
      ['list_npc', { ...EMPTY_METADATA, pageNumber: 2 }],
      ['collection_weapon', { ...EMPTY_METADATA, pageNumber: 5 }]
    ])
  })

  it('reads character master ids from the body and zenith ids from the URL', async () => {
    await harness.respond(`${GAME}/npc/npc/987654321${QUERY}`, {
      master: { id: '3040036000' }
    })
    await harness.respond(`${GAME}/npczenith/bonus_list/3040036000${QUERY}`, {})

    expect(
      harness.intercepted.mock.calls.map((call) => call.slice(2, 4))
    ).toEqual([
      ['character_detail', { ...EMPTY_METADATA, masterId: '3040036000' }],
      ['zenith_npc', { ...EMPTY_METADATA, masterId: '3040036000' }]
    ])
  })

  describe('stashes', () => {
    it('takes the page from the body and the stash number from the URL', async () => {
      await harness.respond(`${GAME}/weapon/container_list/1/3${QUERY}`, {
        current: 4,
        list: []
      })
      await harness.respond(`${GAME}/summon/container_list/1${QUERY}`, {
        list: []
      })

      expect(
        harness.intercepted.mock.calls.map((call) => call.slice(2, 4))
      ).toEqual([
        [
          'stash_weapon',
          { ...EMPTY_METADATA, pageNumber: 4, stashNumber: '3' }
        ],
        ['stash_summon', { ...EMPTY_METADATA, pageNumber: 1, stashNumber: '1' }]
      ])
    })

    it('labels stash pages with the last stash name seen', async () => {
      await harness.respond(
        `${GAME}/container/content/list/3${QUERY}`,
        stashNameResponse('  Grid Weapons  ')
      )
      // A content page without a name keeps the previous one.
      await harness.respond(`${GAME}/container/content/list/4${QUERY}`, {
        data: encodeURIComponent('<div>no name here</div>')
      })
      await harness.respond(`${GAME}/weapon/container_list/1/3${QUERY}`, {
        current: 1
      })
      // Names are not tied to a stash number, and only stashes get one.
      await harness.respond(`${GAME}/weapon/list/1/0${QUERY}`, {})

      expect(harness.intercepted).toHaveBeenCalledTimes(2)
      expect(harness.intercepted.mock.calls[0]![3]).toEqual({
        ...EMPTY_METADATA,
        pageNumber: 1,
        stashNumber: '3',
        stashName: 'Grid Weapons'
      })
      expect(harness.intercepted.mock.calls[1]![3]).toEqual({
        ...EMPTY_METADATA,
        pageNumber: 1
      })
    })

    it('replaces the stash name with a blank one', async () => {
      await harness.respond(
        `${GAME}/container/content/list/3${QUERY}`,
        stashNameResponse('First')
      )
      await harness.respond(
        `${GAME}/container/content/list/4${QUERY}`,
        stashNameResponse('   ')
      )
      await harness.respond(`${GAME}/summon/container_list/1/2${QUERY}`, {})

      expect(harness.intercepted.mock.calls[0]![3]).toMatchObject({
        stashName: ''
      })
    })

    it('drops stash content pages whose HTML cannot be decoded', async () => {
      await harness.respond(
        `${GAME}/container/content/list/3${QUERY}`,
        stashNameResponse('First')
      )
      await harness.respond(`${GAME}/container/content/list/4${QUERY}`, {
        data: '%E0%A4%A'
      })
      await harness.respond(`${GAME}/summon/container_list/1/2${QUERY}`, {})

      expect(harness.intercepted.mock.calls[0]![3]).toMatchObject({
        stashName: 'First'
      })
    })
  })

  describe('UNF scores', () => {
    const totalUrl = `${GAME}/teamraid072/rest/performance//total_performance/3${QUERY}`
    const dailyUrl = `${GAME}/teamraid072/rest/performance//todays_performance/2${QUERY}`

    it('delivers scores on the event page with event and UNF page numbers', async () => {
      harness.setTabUrl(`${GAME}/#event/teamraid072/performance`)

      await harness.respond(totalUrl, { list: [] })
      await harness.respond(dailyUrl, { list: [] })

      expect(
        harness.intercepted.mock.calls.map((call) => call.slice(2, 4))
      ).toEqual([
        ['unf_scores', { ...EMPTY_METADATA, pageNumber: 3, eventNumber: 72 }],
        [
          'unf_daily_scores',
          { ...EMPTY_METADATA, pageNumber: 2, eventNumber: 72 }
        ]
      ])
    })

    it('ignores scores fetched outside the event page', async () => {
      harness.setTabUrl(`${GAME}/#mypage`)
      await harness.respond(totalUrl, { list: [] })

      harness.setTabUrl(undefined)
      await harness.respond(dailyUrl, { list: [] })

      expect(harness.intercepted).not.toHaveBeenCalled()
    })

    it('ignores scores when the tab cannot be looked up', async () => {
      harness.failTabLookup()
      await harness.respond(totalUrl, { list: [] })

      expect(harness.intercepted).not.toHaveBeenCalled()
    })
  })

  it('only delivers guild info on a guild page', async () => {
    const url = `${GAME}/rest/guild/main/guild_info${QUERY}`

    await harness.respond(url, { guild_id: 1 })
    harness.setTabUrl(`${GAME}/#guild/detail/123456`)
    await harness.respond(url, { guild_id: 2 })

    expect(harness.intercepted).toHaveBeenCalledTimes(1)
    expect(harness.intercepted.mock.calls[0]![1]).toEqual({ guild_id: 2 })
  })

  it('skips the tab lookup for data types without a page rule', async () => {
    harness.failTabLookup()
    await harness.respond(`${GAME}/archive/weapon_detail${QUERY}`, { id: 1 })

    expect(harness.intercepted).toHaveBeenCalledWith(
      expect.any(String),
      { id: 1 },
      'detail_weapon',
      EMPTY_METADATA,
      expect.any(Number)
    )
  })

  it('reports an event number on any URL with a teamraid segment', async () => {
    await harness.respond(`${GAME}/teamraid072/npc/list/1/0${QUERY}`, {})

    expect(harness.intercepted.mock.calls[0]!.slice(2, 4)).toEqual([
      'list_npc',
      { ...EMPTY_METADATA, pageNumber: 1, eventNumber: 72 }
    ])
  })

  it('delivers intercepted URLs without a data type as unknown', async () => {
    await harness.respond(
      `${GAME}/rest/performance//total_performance/1${QUERY}`,
      {}
    )

    expect(harness.intercepted.mock.calls[0]![2]).toBe('unknown')
  })

  it('decodes base64 bodies', async () => {
    await harness.respond(
      `${GAME}/archive/npc_detail${QUERY}`,
      {
        master: { id: '3040036000' }
      },
      { base64: true }
    )

    expect(harness.intercepted.mock.calls[0]!.slice(1, 3)).toEqual([
      { master: { id: '3040036000' } },
      'detail_npc'
    ])
  })

  it('ignores responses that are not JSON', async () => {
    await harness.respond(`${GAME}/archive/npc_detail${QUERY}`, null, {
      raw: '<html></html>'
    })

    expect(harness.intercepted).not.toHaveBeenCalled()
  })

  it('never reads bodies of responses it does not intercept', async () => {
    await harness.respond(`${GAME}/quest/content/index${QUERY}`, {})

    expect(harness.getResponseBody).not.toHaveBeenCalled()
    expect(harness.intercepted).not.toHaveBeenCalled()
  })

  it('ignores captured paths on other hosts', async () => {
    await harness.respond('https://example.com/party/deck/1/3', { deck: {} })

    expect(harness.getResponseBody).not.toHaveBeenCalled()
    expect(harness.intercepted).not.toHaveBeenCalled()
  })
})

describe('tab attachment', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await setup()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attaches once a game page finishes loading', async () => {
    await harness.updateTab({ status: 'complete' }, `${GAME}/#mypage`)

    expect(harness.attach).toHaveBeenCalledWith({ tabId: TAB_ID }, '1.3')
  })

  it('does not attach to pages that only mention a game domain', async () => {
    await harness.updateTab(
      { status: 'complete' },
      'https://www.google.com/search?q=game.granbluefantasy.jp'
    )

    expect(harness.attach).not.toHaveBeenCalled()
  })

  it('detaches when the tab navigates away from the game', async () => {
    await harness.updateTab({ status: 'complete' }, `${GAME}/#mypage`)
    await harness.updateTab(
      { status: 'loading', url: 'https://example.com/' },
      'https://example.com/'
    )

    expect(harness.detach).toHaveBeenCalledWith({ tabId: TAB_ID })
  })

  it('stays attached while moving between game pages', async () => {
    await harness.updateTab({ status: 'complete' }, `${GAME}/#mypage`)
    await harness.updateTab(
      { url: `${GAME}/#party/index/0/npc/0` },
      `${GAME}/#party/index/0/npc/0`
    )

    expect(harness.detach).not.toHaveBeenCalled()
  })
})
