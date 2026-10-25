/**
 * What CharacterTags needs to label a character (its element, season,
 * series and whether it's a style swap), looked up from hensei-api by
 * granblue_id. Never asks the game.
 *
 * Kept in chrome.storage for a week: the catalogue rarely changes, and a
 * long Character Stats list shouldn't look every character up each time.
 */

import { apiFetch, getApiUrl } from '../constants.js'
import type { CharacterTagData } from '../types/messages.js'

// Versioned: v1 entries hold elements in Hensei's old numbering (1 Wind …
// 6 Light). The API now uses the game's (1 Fire … 6 Dark), so they're
// ignored and removed on the next write.
const STORAGE_KEY = 'characterTagCache:v2'
const LEGACY_STORAGE_KEY = 'characterTagCache'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const CONCURRENCY = 4

interface StoredTags {
  data: CharacterTagData | null
  fetchedAt: number
}

/** The tag fields of a GET /characters/:id response. */
export function toCharacterTagData(json: unknown): CharacterTagData | null {
  if (!json || typeof json !== 'object') return null
  const c = json as Record<string, unknown>
  const series = Array.isArray(c.series)
    ? c.series.flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return []
        const name = (entry as { name?: { en?: string; ja?: string } }).name
        return name?.en || name?.ja
          ? [{ name: { en: name.en ?? '', ja: name.ja ?? '' } }]
          : []
      })
    : []
  return {
    element: typeof c.element === 'number' ? c.element : null,
    season: typeof c.season === 'number' ? c.season : null,
    series,
    styleSwap: c.style_swap === true
  }
}

type Lookup =
  | { kind: 'found'; data: CharacterTagData | null }
  | { kind: 'failed' }

/**
 * One character's tags. A 404 is a definitive "no such character" and is
 * cached as null; network errors, 429s and 5xx are transient and aren't
 * cached at all, so the next view tries again.
 */
async function fetchOne(granblueId: string): Promise<Lookup> {
  try {
    const response = await apiFetch(
      await getApiUrl(`/characters/${encodeURIComponent(granblueId)}`)
    )
    if (response.status === 404) return { kind: 'found', data: null }
    if (!response.ok) return { kind: 'failed' }
    return { kind: 'found', data: toCharacterTagData(await response.json()) }
  } catch {
    return { kind: 'failed' }
  }
}

let pendingWrite: Promise<unknown> = Promise.resolve()

/**
 * Runs the cache's read-modify-write one at a time, so two overlapping
 * lookups can't overwrite each other's new entries.
 */
function serialized<T>(write: () => Promise<T>): Promise<T> {
  const next = pendingWrite.then(write, write)
  pendingWrite = next.catch(() => undefined)
  return next
}

async function readCache(): Promise<Record<string, StoredTags>> {
  return ((await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] ??
    {}) as Record<string, StoredTags>
}

/** Tag data for each character, from the cache where it's fresh. */
export async function fetchCharacterTags(
  granblueIds: string[]
): Promise<Record<string, CharacterTagData | null>> {
  const ids = [...new Set(granblueIds.filter((id) => /^\d+$/.test(id)))]
  const stored = await readCache()
  const now = Date.now()
  const result: Record<string, CharacterTagData | null> = {}
  const missing: string[] = []
  for (const id of ids) {
    const entry = stored[id]
    if (entry && now - entry.fetchedAt < TTL_MS) result[id] = entry.data
    else missing.push(id)
  }

  const fresh: Record<string, StoredTags> = {}
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const fetched = await Promise.all(batch.map(fetchOne))
    batch.forEach((id, index) => {
      const lookup = fetched[index]
      if (lookup?.kind === 'found') {
        result[id] = lookup.data
        fresh[id] = { data: lookup.data, fetchedAt: now }
      } else {
        result[id] = null
      }
    })
  }

  if (Object.keys(fresh).length > 0) {
    await serialized(async () => {
      const latest = await readCache()
      await chrome.storage.local.set({
        [STORAGE_KEY]: { ...latest, ...fresh }
      })
      await chrome.storage.local.remove(LEGACY_STORAGE_KEY)
    })
  }
  return result
}
