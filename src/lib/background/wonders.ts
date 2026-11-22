import { CACHE_KEYS } from '../constants.js'
import { detectPayloadLanguage } from '../detail-language.js'
import { countWonders } from '../wonders.js'
import type { UploadWondersResponse } from '../types/messages.js'
import { authenticatedPost, getAuthToken } from './api-client.js'

/** The language codes the Wonders import takes. */
export type WondersLanguage = 'en' | 'ja'

/**
 * Caches the Wonders page (`/item/memorial_list/`). Only the response body
 * is kept: the request URL carries the player's uid, so it isn't passed in.
 */
export async function cacheWonders(
  data: unknown,
  timestamp: number
): Promise<boolean> {
  if (!Array.isArray(data)) return false

  await chrome.storage.local.set({
    [CACHE_KEYS.wonders!]: {
      data,
      timestamp,
      totalItems: countWonders(data)
    }
  })
  return true
}

/**
 * The language the Wonders page was captured in. The game sends its text
 * only in the player's game language, so the category and Wonder names
 * decide; the account language covers a capture with no text to judge.
 */
export async function wondersLanguage(
  data: unknown[]
): Promise<WondersLanguage> {
  const named = data.flatMap((category) => {
    const items = (category as { item?: unknown } | null)?.item
    return [category, ...(Array.isArray(items) ? items : [])]
  })
  for (const entry of named) {
    const detected = detectPayloadLanguage(entry)
    if (detected) return detected === 'jp' ? 'ja' : 'en'
  }
  const auth = await getAuthToken()
  return auth?.language === 'ja' ? 'ja' : 'en'
}

/** Sends the captured Wonders page, unchanged, to the collection import. */
export async function uploadWonders(
  data: unknown
): Promise<UploadWondersResponse> {
  if (!Array.isArray(data) || data.length === 0) return { error: 'no_items' }

  const lang = await wondersLanguage(data)
  const result = await authenticatedPost('/collection/wonders/import', {
    data,
    lang
  })
  if (result.error) return { error: result.error }

  const skipped = result.data?.skipped
  return {
    success: true,
    created: (result.data?.created as number | undefined) ?? 0,
    updated: (result.data?.updated as number | undefined) ?? 0,
    skipped: Array.isArray(skipped) ? skipped.length : 0
  }
}
