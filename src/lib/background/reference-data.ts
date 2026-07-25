import {
  apiFetch,
  CACHE_KEYS,
  ELEMENT_VARIANTS_CACHE_TTL_MS,
  getApiUrl,
  RAID_GROUPS_CACHE_TTL_MS
} from '../constants.js'
import {
  authenticatedPost,
  getAuthToken,
  parseErrorResponse
} from './api-client.js'
import type {
  CreatePlaylistResult,
  FetchElementVariantsResult,
  FetchPlaylistsResult,
  FetchRaidGroupsResult,
  VersionCheckResult
} from './types.js'

interface CollectionIds {
  weapons?: string[]
  summons?: string[]
  characters?: string[]
  artifacts?: string[]
}

let collectionIdsCache: CollectionIds | null = null
let collectionIdsCacheTime = 0
const COLLECTION_IDS_TTL_MS = 5 * 60 * 1000

export async function checkExtensionVersion(): Promise<VersionCheckResult | null> {
  try {
    const apiUrl = await getApiUrl('/version')
    const response = await apiFetch(apiUrl)
    if (!response.ok) return null

    const data = (await response.json()) as {
      extension?: { version?: string }
    }
    if (!data.extension?.version) return null

    const current = chrome.runtime.getManifest().version
    const latest = data.extension.version

    const isOutdated = compareVersions(current, latest) < 0
    return { isOutdated, current, latest }
  } catch {
    return null
  }
}

export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const leftPart = left[i] ?? 0
    const rightPart = right[i] ?? 0
    if (leftPart < rightPart) return -1
    if (leftPart > rightPart) return 1
  }
  return 0
}

export async function fetchUserPlaylists(): Promise<FetchPlaylistsResult> {
  try {
    const auth = await getAuthToken()
    if (!auth) return { error: 'not_logged_in' }

    const response = await apiFetch(
      await getApiUrl(`/users/${auth.user.username}/playlists?per_page=100`),
      {
        headers: { Authorization: `Bearer ${auth.access_token}` }
      }
    )
    if (!response.ok) throw new Error('request_failed')
    const data = await response.json()
    return { data }
  } catch (error) {
    console.error('Failed to fetch playlists:', error)
    return { error: 'request_failed' }
  }
}

export async function createPlaylist({
  title,
  description,
  visibility
}: {
  title: string
  description: string
  visibility: number
}): Promise<CreatePlaylistResult> {
  try {
    const result = await authenticatedPost('/playlists', {
      playlist: { title, description, visibility: visibility || 3 }
    })
    return result
  } catch (error) {
    console.error('Failed to create playlist:', error)
    return { error: 'request_failed' }
  }
}

export async function fetchRaidGroups(
  forceRefresh = false
): Promise<FetchRaidGroupsResult> {
  const cacheKey = CACHE_KEYS.raid_groups!
  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey] as
    | { timestamp: number; data: unknown }
    | undefined

  if (
    !forceRefresh &&
    cached?.timestamp &&
    Date.now() - cached.timestamp < RAID_GROUPS_CACHE_TTL_MS
  ) {
    return { data: cached.data }
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl('/raid_groups')
  try {
    const response = await apiFetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) {
      return { error: await parseErrorResponse(response) }
    }

    const data = await response.json()

    await chrome.storage.local.set({
      [cacheKey]: { data, timestamp: Date.now() }
    })

    return { data }
  } catch {
    return { error: 'request_failed' }
  }
}

export async function fetchElementVariants(
  forceRefresh = false
): Promise<FetchElementVariantsResult> {
  const cacheKey = CACHE_KEYS.element_variants!
  const result = await chrome.storage.local.get(cacheKey)
  const cached = result[cacheKey] as
    | { timestamp: number; data: unknown }
    | undefined

  if (
    !forceRefresh &&
    cached?.timestamp &&
    Date.now() - cached.timestamp < ELEMENT_VARIANTS_CACHE_TTL_MS
  ) {
    return { data: cached.data }
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl('/weapons/element_variants')
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) {
      return { error: await parseErrorResponse(response) }
    }

    const data = await response.json()

    await chrome.storage.local.set({
      [cacheKey]: { data, timestamp: Date.now() }
    })

    return { data }
  } catch {
    return { error: 'request_failed' }
  }
}

export async function getCollectionIds(): Promise<
  CollectionIds & { error?: string }
> {
  const now = Date.now()
  if (
    collectionIdsCache &&
    now - collectionIdsCacheTime < COLLECTION_IDS_TTL_MS
  ) {
    return collectionIdsCache
  }

  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  const userId = auth.user?.id
  if (!userId) return { error: 'not_logged_in' }

  const apiUrl = await getApiUrl(`/users/${userId}/collection/game_ids`)
  try {
    const response = await apiFetch(apiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${auth.access_token}`
      }
    })

    if (!response.ok) return { error: 'request_failed' }

    const data = (await response.json()) as CollectionIds
    collectionIdsCache = data
    collectionIdsCacheTime = now
    return data
  } catch {
    return { error: 'request_failed' }
  }
}

export function invalidateCollectionIdsCache(): void {
  collectionIdsCache = null
}
