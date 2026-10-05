/**
 * Pure URL and response classification for intercepted game requests.
 * Decides which responses are read, which data type each one is, and the
 * metadata the capture handler caches it under. Nothing here touches
 * chrome APIs or holds state; debugger.ts owns both.
 */

// ==========================================
// ENDPOINT PATTERNS TO INTERCEPT
// ==========================================

export const GBF_DOMAINS = [
  'game.granbluefantasy.jp',
  'gbf.game.mbga.jp',
  'steam.granbluefantasy.com'
]

const STASH_CONTENT_PATTERN = '/container/content/list/'

export const INTERCEPT_PATTERNS = [
  '/party/deck',
  '/archive/npc_detail',
  '/archive/weapon_detail',
  '/archive/summon_detail',
  '/npc/list/',
  '/weapon/list/',
  '/summon/list/',
  // Collection pages (inventory)
  '/rest/weapon/list/',
  '/rest/npc/list/',
  '/rest/summon/list/',
  '/rest/artifact/list/',
  // Character detail page (for awakening data)
  '/npc/npc/',
  // Zenith/EMP pages (for mastery bonuses)
  '/npczenith/bonus_list/',
  '/npczenith/content/index/',
  // Stash (container) pages
  '/weapon/container_list/',
  '/summon/container_list/',
  // Stash content pages (for extracting stash names from HTML)
  STASH_CONTENT_PATTERN,
  // UNF (Unite & Fight) score pages (double-slash is empty user ID segment)
  '/total_performance/',
  '/todays_performance/',
  // Guild info (for crew ID)
  '/rest/guild/main/guild_info',
  // Profile page (for support summons — HTML payload inside JSON envelope)
  '/profile/content/index/'
]

/**
 * Whether a response should be read. Matches anywhere in the URL and never
 * checks the host, so any URL containing a pattern passes.
 */
/** The URL, if it's an https URL on one of the game's own hosts. */
function parseGameUrl(url: string | undefined): URL | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    return GBF_DOMAINS.includes(parsed.hostname) ? parsed : null
  } catch {
    return null
  }
}

/** Whether a page or request URL is on one of the game's own hosts. */
export function isGameUrl(url: string | undefined): boolean {
  return parseGameUrl(url) !== null
}

/** The path part of a URL; patterns never match the query or hash. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

/** Whether a response is game data the extension reads. */
export function shouldIntercept(url: string): boolean {
  const parsed = parseGameUrl(url)
  if (!parsed) return false
  return INTERCEPT_PATTERNS.some((pattern) => parsed.pathname.includes(pattern))
}

/** Stash content pages are read only for the stash name in their HTML. */
export function isStashContentUrl(url: string): boolean {
  return pathOf(url).includes(STASH_CONTENT_PATTERN)
}

// ==========================================
// DATA TYPES
// ==========================================

export interface DataTypeRule {
  dataType: string
  /** Every one of these must appear somewhere in the URL's path. */
  includes: readonly string[]
}

/**
 * Ordered: the first matching rule wins. Several patterns contain others,
 * so a more specific rule must come before any rule it would also match:
 *
 * - '/rest/weapon/list/' contains '/weapon/list/' (same for npc, summon),
 *   so collections come before list pages.
 * - total_performance comes before todays_performance, and both need a
 *   '/teamraid' segment as well.
 *
 * intercept-routes.test.ts checks that no rule is shadowed by an earlier one.
 */
export const DATA_TYPE_RULES: readonly DataTypeRule[] = [
  { dataType: 'party', includes: ['/party/deck'] },
  { dataType: 'detail_npc', includes: ['/archive/npc_detail'] },
  { dataType: 'detail_weapon', includes: ['/archive/weapon_detail'] },
  { dataType: 'detail_summon', includes: ['/archive/summon_detail'] },
  { dataType: 'character_detail', includes: ['/npc/npc/'] },
  { dataType: 'zenith_npc', includes: ['/npczenith/bonus_list/'] },
  { dataType: 'zenith_npc', includes: ['/npczenith/content/index/'] },
  { dataType: 'stash_weapon', includes: ['/weapon/container_list/'] },
  { dataType: 'stash_summon', includes: ['/summon/container_list/'] },
  // Collections before list pages: '/rest/x/list/' contains '/x/list/'.
  { dataType: 'collection_weapon', includes: ['/rest/weapon/list/'] },
  { dataType: 'collection_npc', includes: ['/rest/npc/list/'] },
  { dataType: 'collection_summon', includes: ['/rest/summon/list/'] },
  { dataType: 'collection_artifact', includes: ['/rest/artifact/list/'] },
  { dataType: 'list_npc', includes: ['/npc/list/'] },
  { dataType: 'list_weapon', includes: ['/weapon/list/'] },
  { dataType: 'list_summon', includes: ['/summon/list/'] },
  { dataType: 'unf_scores', includes: ['/total_performance/', '/teamraid'] },
  {
    dataType: 'unf_daily_scores',
    includes: ['/todays_performance/', '/teamraid']
  },
  { dataType: 'guild_info', includes: ['/rest/guild/main/guild_info'] },
  { dataType: 'support_summons', includes: ['/profile/content/index/'] }
]

export function getDataType(url: string): string {
  const path = pathOf(url)
  const rule = DATA_TYPE_RULES.find(({ includes }) =>
    includes.every((pattern) => path.includes(pattern))
  )
  return rule?.dataType ?? 'unknown'
}

// ==========================================
// PAGE CONTEXT
// ==========================================

// These data types are only captured while the tab is on the matching page.
const PAGE_CONTEXT_RULES: Record<string, (hash: string) => boolean> = {
  guild_info: (hash) => hash.startsWith('#guild/'),
  unf_scores: (hash) => hash.startsWith('#event/teamraid'),
  unf_daily_scores: (hash) => hash.startsWith('#event/teamraid')
}

/** Whether capturing this data type depends on the tab's current page. */
export function requiresPageContext(dataType: string): boolean {
  return Boolean(PAGE_CONTEXT_RULES[dataType])
}

/** Whether a tab on `tabUrl` is a valid page to capture `dataType` from. */
export function matchesPageContext(
  dataType: string,
  tabUrl: string | undefined
): boolean {
  const rule = PAGE_CONTEXT_RULES[dataType]
  if (!rule) return true

  try {
    return rule(new URL(tabUrl ?? '').hash)
  } catch {
    return false
  }
}

// ==========================================
// METADATA
// ==========================================

export interface InterceptMetadata {
  pageNumber: number | null
  partyId: string | null
  masterId: string | null
  stashNumber: string | null
  stashName: string | null
  eventNumber: number | null
}

/**
 * Builds the metadata handed to the capture handler. `stashName` is the
 * last name read from a stash content page; it is only used for stashes.
 */
export function buildInterceptMetadata(
  url: string,
  data: unknown,
  dataType: string,
  stashName: string | null
): InterceptMetadata {
  const isStash = dataType.startsWith('stash_')

  let pageNumber = getPageNumber(url)
  if (isStash) {
    pageNumber = (data as { current?: number })?.current ?? 1
  } else if (dataType === 'unf_scores' || dataType === 'unf_daily_scores') {
    pageNumber = getUnfPageNumber(url)
  }

  return {
    pageNumber,
    partyId: dataType === 'party' ? getPartyId(url, data) : null,
    masterId: getMasterId(url, data, dataType),
    stashNumber: isStash ? getStashNumber(url) : null,
    stashName: isStash ? stashName : null,
    eventNumber: getEventNumber(url)
  }
}

export function getPageNumber(url: string): number | null {
  const match = url.match(/\/list\/(\d+)/)
  return match ? parseInt(match[1]!, 10) : null
}

export function getStashNumber(url: string): string {
  const match = url.match(/\/(?:weapon|summon)\/container_list\/\d+\/(\d+)/)
  return match ? match[1]! : '1'
}

/**
 * Reads the stash name from a stash content page's URI-encoded HTML.
 * Returns null when there is no name; throws if the HTML can't be decoded.
 */
export function parseStashName(data: { data?: string }): string | null {
  if (!data?.data) return null

  const html = decodeURIComponent(data.data)
  const nameMatch = html.match(/class="prt-container-name">([^<]+)</)
  return nameMatch ? nameMatch[1]!.trim() : null
}

export function getPartyId(url: string, data: unknown): string | null {
  const urlMatch = url.match(/\/party\/deck\/(\d+)\/(\d+)/)
  if (urlMatch) {
    return `${urlMatch[1]}_${urlMatch[2]}`
  }

  const deckData = data as { deck?: { priority?: number; name?: string } }
  if (deckData?.deck) {
    if (deckData.deck.priority !== undefined) {
      return `deck_${deckData.deck.priority}`
    }
    if (deckData.deck.name) {
      return deckData.deck.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .substring(0, 20)
    }
  }

  return null
}

export function getMasterId(
  url: string,
  data: unknown,
  dataType: string
): string | null {
  if (dataType === 'zenith_npc') {
    let match = url.match(/\/npczenith\/bonus_list\/(\d+)/)
    if (match) return match[1]!

    match = url.match(/\/npczenith\/content\/index\/(\d+)/)
    if (match) return match[1]!
  } else if (dataType === 'character_detail') {
    return (data as { master?: { id?: string } })?.master?.id ?? null
  }

  return null
}

export function getEventNumber(url: string): number | null {
  const match = url.match(/\/teamraid0*(\d+)\//)
  return match ? parseInt(match[1]!, 10) : null
}

export function getUnfPageNumber(url: string): number | null {
  const match = url.match(/\/(?:total|todays)_performance\/(\d+)/)
  return match ? parseInt(match[1]!, 10) : null
}
