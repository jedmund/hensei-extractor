import { formatCacheStatus } from '../cache.js'
import type { CacheStatusInfo, FormattedCacheStatus } from '../types/cache.js'
import type {
  CachedDataResponse,
  UploadPartyResponse,
  UploadDetailResponse,
  UploadCollectionResponse,
  UploadUnfScoresResponse,
  CreateCrewResponse,
  FetchLatestGwEventResponse,
  PreviewGwPhantomsResponse,
  CheckConflictsResponse,
  PreviewSyncDeletionsResponse,
  FetchRaidGroupsResponse,
  FetchPlaylistsResponse,
  CreatePlaylistResponse,
  CollectionIdsResponse,
  CheckVersionResponse
} from '../types/messages.js'

function send(message: Record<string, unknown>): Promise<unknown> {
  return chrome.runtime.sendMessage(message)
}

export async function getCacheStatus(): Promise<
  Record<string, FormattedCacheStatus>
> {
  const raw = (await send({ action: 'getCacheStatus' })) as Record<
    string,
    CacheStatusInfo
  >
  return formatCacheStatus(raw || {})
}

export async function getCachedData(
  dataType: string
): Promise<CachedDataResponse> {
  return send({
    action: 'getCachedData',
    dataType
  }) as Promise<CachedDataResponse>
}

export async function uploadPartyData(options: {
  dataType: string
  name?: string
  raid?: { slug?: string }
  visibility?: number
  shareWithCrew?: boolean
  playlists?: Array<{ id: string }>
}): Promise<UploadPartyResponse> {
  return send({
    action: 'uploadPartyData',
    dataType: options.dataType,
    name: options.name,
    raidSlug: options.raid?.slug,
    visibility: options.visibility,
    shareWithCrew: options.shareWithCrew,
    playlistIds: options.playlists?.map((p) => p.id)
  }) as Promise<UploadPartyResponse>
}

export async function uploadCollectionData(
  dataType: string,
  selectedIndices: number[],
  conflictResolutions?: Record<string, 'import' | 'skip'> | null
): Promise<UploadCollectionResponse> {
  return send({
    action: 'uploadCollectionData',
    dataType,
    selectedIndices,
    conflictResolutions
  }) as Promise<UploadCollectionResponse>
}

export async function uploadDetailData(
  dataType: string
): Promise<UploadDetailResponse> {
  return send({
    action: 'uploadDetailData',
    dataType
  }) as Promise<UploadDetailResponse>
}

export async function uploadCharacterStats(
  selectedIndices: number[]
): Promise<UploadCollectionResponse> {
  return send({
    action: 'uploadCharacterStats',
    selectedIndices
  }) as Promise<UploadCollectionResponse>
}

export async function checkConflicts(
  dataType: string,
  selectedIndices: number[]
): Promise<CheckConflictsResponse> {
  return send({
    action: 'checkConflicts',
    dataType,
    selectedIndices
  }) as Promise<CheckConflictsResponse>
}

export async function fetchRaidGroups(
  forceRefresh = false
): Promise<FetchRaidGroupsResponse> {
  return send({
    action: 'fetchRaidGroups',
    forceRefresh
  }) as Promise<FetchRaidGroupsResponse>
}

export async function fetchUserPlaylists(): Promise<FetchPlaylistsResponse> {
  return send({
    action: 'fetchUserPlaylists'
  }) as Promise<FetchPlaylistsResponse>
}

export async function createPlaylist(data: {
  title: string
  description?: string
  visibility?: number
}): Promise<CreatePlaylistResponse> {
  return send({
    action: 'createPlaylist',
    data
  }) as Promise<CreatePlaylistResponse>
}

export async function getCollectionIds(): Promise<CollectionIdsResponse> {
  return send({ action: 'getCollectionIds' }) as Promise<CollectionIdsResponse>
}

export async function uploadUnfScores(
  dataType: string,
  round: string
): Promise<UploadUnfScoresResponse> {
  return send({
    action: 'uploadUnfScores',
    dataType,
    round
  }) as Promise<UploadUnfScoresResponse>
}

export async function previewGwPhantoms(
  dataType: string
): Promise<PreviewGwPhantomsResponse> {
  return send({
    action: 'previewGwPhantoms',
    dataType
  }) as Promise<PreviewGwPhantomsResponse>
}

export async function fetchLatestGwEvent(): Promise<FetchLatestGwEventResponse> {
  return send({
    action: 'fetchLatestGwEvent'
  }) as Promise<FetchLatestGwEventResponse>
}

export async function createCrew(name: string): Promise<CreateCrewResponse> {
  return send({
    action: 'createCrew',
    name
  }) as Promise<CreateCrewResponse>
}

export async function clearCache(): Promise<void> {
  await send({ action: 'clearCache' })
}

export async function checkExtensionVersion(): Promise<CheckVersionResponse | null> {
  return send({
    action: 'checkExtensionVersion'
  }) as Promise<CheckVersionResponse | null>
}

export async function popOutWindow(): Promise<void> {
  await send({ action: 'popOutWindow' })
}

export async function previewSyncDeletions(
  dataType: string
): Promise<PreviewSyncDeletionsResponse> {
  return send({
    action: 'previewSyncDeletions',
    dataType
  }) as Promise<PreviewSyncDeletionsResponse>
}

export async function syncCollection(
  dataType: string,
  selectedIndices: number[],
  deletionIds: string[]
): Promise<UploadCollectionResponse> {
  return send({
    action: 'syncCollection',
    dataType,
    selectedIndices,
    deletionIds
  }) as Promise<UploadCollectionResponse>
}
