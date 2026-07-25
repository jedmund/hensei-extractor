import {
  apiFetch,
  CACHE_KEYS,
  getApiUrl,
  resolveCacheKey
} from '../constants.js'
import type { FetchLatestGwEventResponse } from '../types/messages.js'
import { authenticatedPost } from './api-client.js'
import type { CachedGuildInfo, CachedUnfScores, UnfMember } from './types.js'

export async function handleUploadUnfScores(
  dataType: string,
  round: string
): Promise<{
  success?: boolean
  imported?: number
  phantomsCreated?: number
  errors?: unknown[]
  error?: string
}> {
  const cacheKey = resolveCacheKey(dataType)
  if (!cacheKey) return { error: 'unknown_type' }

  const stored = await chrome.storage.local.get(cacheKey)
  const cached = stored[cacheKey] as CachedUnfScores | undefined
  if (!cached || cached.memberCount === 0) return { error: 'no_cached_data' }

  const allMembers: UnfMember[] = []
  for (const page of Object.values(cached.pages)) {
    allMembers.push(...page)
  }

  const isCumulative = dataType.startsWith('unf_scores_')

  const result = await authenticatedPost('/crew/import_gw_scores', {
    event_number: cached.eventNumber,
    round,
    is_cumulative: isCumulative,
    members: allMembers.map((member) => ({
      granblue_id: member.id,
      name: member.name,
      score: member.contribution
    }))
  })

  if (result.error) return { error: result.error }

  const data = result.data!
  return {
    success: true,
    imported: data.imported as number,
    phantomsCreated: data.phantoms_created as number,
    errors: (data.errors as unknown[]) ?? []
  }
}

export async function handlePreviewGwPhantoms(dataType: string): Promise<{
  existingPhantomIds?: string[]
  newPhantomIds?: string[]
  error?: string
}> {
  const cacheKey = resolveCacheKey(dataType)
  if (!cacheKey) return { error: 'unknown_type' }

  const stored = await chrome.storage.local.get(cacheKey)
  const cached = stored[cacheKey] as CachedUnfScores | undefined
  if (!cached || cached.memberCount === 0) return { error: 'no_cached_data' }

  const allMembers: UnfMember[] = []
  for (const page of Object.values(cached.pages)) {
    allMembers.push(...page)
  }

  const result = await authenticatedPost('/crew/preview_gw_phantoms', {
    granblue_ids: allMembers.map((member) => member.id)
  })

  if (result.error) return { error: result.error }
  const data = result.data as {
    existing_phantom_ids: string[]
    new_phantom_ids: string[]
  }
  return {
    existingPhantomIds: data.existing_phantom_ids,
    newPhantomIds: data.new_phantom_ids
  }
}

export async function handleCreateCrew(
  name: string
): Promise<{ success?: boolean; crew?: unknown; error?: string }> {
  const guildResult = await chrome.storage.local.get(CACHE_KEYS.guild_info!)
  const guildInfo = guildResult[CACHE_KEYS.guild_info!] as
    | CachedGuildInfo
    | undefined
  const guildId = guildInfo?.guildId

  const body: Record<string, unknown> = { crew: { name } }
  if (guildId) {
    ;(body.crew as Record<string, unknown>).granblue_crew_id = guildId
  }

  const result = await authenticatedPost('/crews', body)
  if (result.error) {
    if (result.error.includes('granblue_crew_id')) {
      return { error: 'crew_already_exists' }
    }
    return { error: result.error }
  }

  const authResult = await chrome.storage.local.get('gbAuth')
  const auth = authResult.gbAuth as Record<string, unknown> | undefined
  if (auth) {
    auth.hasCrew = true
    await chrome.storage.local.set({ gbAuth: auth })
  }

  return { success: true, crew: result.data }
}

export async function handleFetchLatestGwEvent(): Promise<FetchLatestGwEventResponse> {
  try {
    const apiUrl = await getApiUrl('/gw_events/status')
    const response = await apiFetch(apiUrl)
    if (!response.ok) return { error: 'request_failed' }

    const data = (await response.json()) as {
      upcoming: {
        event_number: number
        start_date: string
        end_date: string
      } | null
      recent: {
        event_number: number
        start_date: string
        end_date: string
      } | null
    }

    return {
      recent: data.recent
        ? {
            eventNumber: data.recent.event_number,
            startDate: data.recent.start_date,
            endDate: data.recent.end_date
          }
        : null,
      upcoming: data.upcoming
        ? {
            eventNumber: data.upcoming.event_number,
            startDate: data.upcoming.start_date,
            endDate: data.upcoming.end_date
          }
        : null
    }
  } catch {
    return { error: 'request_failed' }
  }
}
