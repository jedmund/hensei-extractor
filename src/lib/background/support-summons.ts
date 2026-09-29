import { CACHE_KEYS } from '../constants.js'
import {
  parseSupportSummons,
  type ParsedSupportSummonPayload
} from '../parsers/support-summons.js'
import type { UploadSupportSummonsResponse } from '../types/messages.js'
import { authenticatedPost } from './api-client.js'

// Parses the profile HTML at capture time so uploads and status readers work
// with the extracted slot list. Captures of other players' profiles are
// dropped so they can't replace the user's own.
export async function cacheSupportSummons(
  data: unknown,
  timestamp: number,
  url: string
): Promise<boolean> {
  const parsed = parseSupportSummons(data, url)
  if (!parsed.is_own_profile) return false

  await chrome.storage.local.set({
    [CACHE_KEYS.support_summons!]: {
      data: parsed,
      timestamp,
      url,
      totalItems: parsed.items.length,
      gbfUserId: parsed.gbf_user_id
    }
  })
  return true
}

export async function uploadSupportSummons(
  parsed: ParsedSupportSummonPayload
): Promise<UploadSupportSummonsResponse> {
  if (!parsed?.items) return { error: 'no_items' }

  const result = await authenticatedPost('/support_summons/import', {
    support_summons: parsed.items.map((item) => ({
      gbf_section: item.gbf_section,
      position: item.position,
      granblue_id: item.granblue_id,
      level: item.level
    }))
  })
  if (result.error) {
    // The API rolls back the whole import if any summon is missing from its
    // database, so say which ones instead of a generic failure.
    const unknown = (result.errors ?? [])
      .filter((e) => e.error === 'Summon not found' && e.granblue_id)
      .map((e) => e.granblue_id!)
    if (unknown.length > 0) {
      return { error: 'unknown_summons', unknownSummons: unknown }
    }
    return { error: result.error }
  }

  const meta = result.data?.meta as { created?: number } | undefined
  return { success: true, created: meta?.created ?? 0 }
}
