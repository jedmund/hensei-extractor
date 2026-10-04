/**
 * Reference lookups the party detail view needs to label a captured deck:
 * the support summon, weapon keys, AX modifier names and job skill slugs.
 * None of these endpoints need a login.
 */

import type {
  JobSkillSlugs,
  SummonSearchResult,
  UiLocale,
  WeaponKeyMap,
  WeaponStatModifiers
} from '../types/messages.js'
import { apiFetch, getApiUrl } from '../constants.js'

// Kept in memory for the life of the service worker. Not keyed by locale:
// the key map keeps the names of whichever language asked for it first.
let weaponKeyMapCache: WeaponKeyMap | null = null
let weaponStatModifiersCache: WeaponStatModifiers | null = null
let jobSkillCache: Record<string, string | null> = {}

/** Finds the summon whose English or Japanese name matches exactly, or null. */
export async function searchSummonByName(
  name: string
): Promise<SummonSearchResult | null> {
  if (!name) return null
  try {
    const apiUrl = await getApiUrl('/search/summons')
    const response = await apiFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: { query: name } })
    })
    if (!response.ok) return null
    const json = await response.json()
    const results: SummonSearchResult[] = json.results || []
    return (
      results.find((s) => s.name?.en === name || s.name?.ja === name) || null
    )
  } catch {
    return null
  }
}

/** Maps weapon key skill ids to the key's slug and name in `locale`. */
export async function fetchWeaponKeyMap(
  locale: UiLocale
): Promise<WeaponKeyMap | null> {
  if (weaponKeyMapCache) return weaponKeyMapCache
  try {
    const [skillMapRes, weaponKeysRes] = await Promise.all([
      apiFetch(await getApiUrl('/weapon_keys/skill_map')),
      apiFetch(await getApiUrl('/weapon_keys'))
    ])
    if (!skillMapRes.ok || !weaponKeysRes.ok) return null
    const skillMap: Record<string, string> = await skillMapRes.json()
    const weaponKeys: Array<{ slug: string; name: Record<string, string> }> =
      await weaponKeysRes.json()

    const slugToName: Record<string, string> = {}
    for (const key of weaponKeys) {
      slugToName[key.slug] = key.name[locale] || key.name.en || key.slug
    }

    const result: WeaponKeyMap = {}
    for (const [skillId, slug] of Object.entries(skillMap)) {
      result[skillId] = { slug, name: slugToName[slug] || slug }
    }

    weaponKeyMapCache = result
    return weaponKeyMapCache
  } catch {
    return null
  }
}

/** AX and stat modifier names keyed by slug. */
export async function fetchWeaponStatModifiers(): Promise<WeaponStatModifiers | null> {
  if (weaponStatModifiersCache) return weaponStatModifiersCache
  try {
    const apiUrl = await getApiUrl('/weapon_stat_modifiers')
    const response = await apiFetch(apiUrl)
    if (!response.ok) return null
    const modifiers = (await response.json()) as Array<{
      slug: string
      name_en: string
      name_jp: string
      suffix?: string
    }>
    weaponStatModifiersCache = {}
    for (const mod of modifiers) {
      weaponStatModifiersCache[mod.slug] = {
        nameEn: mod.name_en,
        nameJp: mod.name_jp,
        suffix: mod.suffix || ''
      }
    }
    return weaponStatModifiersCache
  } catch {
    return null
  }
}

/**
 * Resolves job skill names to slugs, null where unknown. Names already looked
 * up, including unknown ones, aren't requested again.
 */
export async function fetchJobSkillSlugs(
  names: string[]
): Promise<JobSkillSlugs> {
  const uncached = names.filter((n) => !(n in jobSkillCache))
  if (uncached.length === 0) {
    return Object.fromEntries(names.map((n) => [n, jobSkillCache[n] || null]))
  }
  try {
    const apiUrl = await getApiUrl('/job_skills/resolve')
    const response = await apiFetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: uncached })
    })
    if (response.ok) {
      const results = await response.json()
      for (const r of results) jobSkillCache[r.name] = r.slug
    }
  } catch {
    /* fall through */
  }
  return Object.fromEntries(names.map((n) => [n, jobSkillCache[n] || null]))
}

/** For tests. */
export function resetPartyReferenceCaches(): void {
  weaponKeyMapCache = null
  weaponStatModifiersCache = null
  jobSkillCache = {}
}
