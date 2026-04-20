/**
 * Helpers for the element-variant map.
 *
 * Element-changeable weapons (Ultima, Atma, CCW, Superlative) have per-element
 * game variant IDs that aren't uploaded to the S3 image bucket. The hensei-api
 * exposes the base granblue_id → {element: variantId} map via
 * GET /weapons/element_variants, which the extension caches in
 * chrome.storage.local. These helpers read that cache and map a variant game ID
 * back to its base granblue_id so we can fall back to the base thumbnail when
 * a variant image 404s.
 */
import { CACHE_KEYS } from './constants.js'
import type { ElementVariantEntry } from './types/messages.js'

let variantToBaseCache: Map<string, string> | null = null

export type { ElementVariantEntry }

export async function getCachedElementVariants(): Promise<
  ElementVariantEntry[] | null
> {
  const cacheKey = CACHE_KEYS.element_variants!
  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey] as
    | { timestamp: number; data: ElementVariantEntry[] }
    | undefined
  return cached?.data ?? null
}

function buildVariantToBaseMap(
  entries: ElementVariantEntry[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const baseId = entry.granblue_id
    if (!baseId || !entry.element_variant_ids) continue
    for (const variantId of Object.values(entry.element_variant_ids)) {
      if (variantId) map.set(variantId, baseId)
    }
  }
  return map
}

export async function getBaseGranblueIdForVariant(
  candidateId: string
): Promise<string | null> {
  if (!candidateId) return null
  if (!variantToBaseCache) {
    const entries = await getCachedElementVariants()
    if (!entries) return null
    variantToBaseCache = buildVariantToBaseMap(entries)
  }
  return variantToBaseCache.get(candidateId) ?? null
}

/** Reset the in-memory lookup cache (e.g. after the storage cache is refreshed). */
export function resetElementVariantsMemo(): void {
  variantToBaseCache = null
}

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[CACHE_KEYS.element_variants!]) {
      variantToBaseCache = null
    }
  })
}
