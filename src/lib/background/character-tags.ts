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

const STORAGE_KEY = 'characterTagCache'
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
        return name?.en || name?.ja ? [{ name: { en: name.en ?? '', ja: name.ja ?? '' } }] : []
      })
    : []
  return {
    element: typeof c.element === 'number' ? c.element : null,
    season: typeof c.season === 'number' ? c.season : null,
    series,
    styleSwap: c.style_swap === true
  }
}

async function fetchOne(granblueId: string): Promise<CharacterTagData | null> {
  try {
    const response = await apiFetch(await getApiUrl(`/characters/${encodeURIComponent(granblueId)}`))
    if (!response.ok) return null
    return toCharacterTagData(await response.json())
  } catch {
    return null
  }
}

/** Tag data for each character, from the cache where it's fresh. */
export async function fetchCharacterTags(
  granblueIds: string[]
): Promise<Record<string, CharacterTagData | null>> {
  const ids = [...new Set(granblueIds.filter((id) => /^\d+$/.test(id)))]
  const stored = ((await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] ?? {}) as Record<
    string,
    StoredTags
  >
  const now = Date.now()
  const result: Record<string, CharacterTagData | null> = {}
  const missing: string[] = []
  for (const id of ids) {
    const entry = stored[id]
    if (entry && now - entry.fetchedAt < TTL_MS) result[id] = entry.data
    else missing.push(id)
  }

  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY)
    const fetched = await Promise.all(batch.map(fetchOne))
    batch.forEach((id, index) => {
      result[id] = fetched[index] ?? null
      stored[id] = { data: fetched[index] ?? null, fetchedAt: now }
    })
  }

  if (missing.length > 0) await chrome.storage.local.set({ [STORAGE_KEY]: stored })
  return result
}
