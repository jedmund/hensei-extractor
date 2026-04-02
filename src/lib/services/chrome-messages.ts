import { formatCacheStatus } from '../cache.js'
import type { FormattedCacheStatus } from '../types/cache.js'

function send(message: Record<string, unknown>): Promise<any> {
  return chrome.runtime.sendMessage(message)
}

export async function getCacheStatus(): Promise<
  Record<string, FormattedCacheStatus>
> {
  const raw = await send({ action: 'getCacheStatus' })
  return formatCacheStatus(raw || {})
}

export async function getCachedData(
  dataType: string
): Promise<{ data?: any; error?: string }> {
  return send({ action: 'getCachedData', dataType })
}

export async function uploadPartyData(options: {
  dataType: string
  name?: string
  raid?: { slug?: string }
  visibility?: number
  shareWithCrew?: boolean
  playlists?: Array<{ id: string }>
}): Promise<{ data?: any; error?: string }> {
  return send({
    action: 'uploadPartyData',
    dataType: options.dataType,
    name: options.name,
    raidSlug: options.raid?.slug,
    visibility: options.visibility,
    shareWithCrew: options.shareWithCrew,
    playlistIds: options.playlists?.map((p) => p.id)
  })
}

export async function uploadCollectionData(
  dataType: string,
  selectedIndices: number[],
  conflictResolutions?: Record<string, 'import' | 'skip'> | null
): Promise<{ data?: any; error?: string }> {
  return send({
    action: 'uploadCollectionData',
    dataType,
    selectedIndices,
    conflictResolutions
  })
}

export async function uploadDetailData(
  dataType: string
): Promise<{ data?: any; error?: string }> {
  return send({ action: 'uploadDetailData', dataType })
}

export async function uploadCharacterStats(
  selectedIndices: number[]
): Promise<{ data?: any; error?: string }> {
  return send({ action: 'uploadCharacterStats', selectedIndices })
}

export async function checkConflicts(
  dataType: string,
  selectedIndices: number[]
): Promise<{ data?: { conflicts?: unknown[] }; error?: string }> {
  return send({ action: 'checkConflicts', dataType, selectedIndices })
}

export async function fetchRaidGroups(
  forceRefresh = false
): Promise<{ data?: unknown[]; error?: string }> {
  return send({ action: 'fetchRaidGroups', forceRefresh })
}

export async function fetchUserPlaylists(): Promise<{
  data?: any
  error?: string
}> {
  return send({ action: 'fetchUserPlaylists' })
}

export async function createPlaylist(data: {
  title: string
  description?: string
  visibility?: number
}): Promise<{ data?: any; error?: string }> {
  return send({ action: 'createPlaylist', data })
}

export async function getCollectionIds(): Promise<{
  data?: Record<string, Set<string>>
  error?: string
}> {
  return send({ action: 'getCollectionIds' })
}

export async function clearCache(): Promise<void> {
  await send({ action: 'clearCache' })
}

export async function checkExtensionVersion(): Promise<{
  data?: { latest?: string }
  error?: string
}> {
  return send({ action: 'checkExtensionVersion' })
}

export async function popOutWindow(): Promise<void> {
  await send({ action: 'popOutWindow' })
}

export async function previewSyncDeletions(
  dataType: string
): Promise<{ data?: any; error?: string }> {
  return send({ action: 'previewSyncDeletions', dataType })
}

export async function syncCollection(
  dataType: string,
  selectedIndices: number[],
  deletionIds: string[]
): Promise<{ data?: any; error?: string }> {
  return send({
    action: 'syncCollection',
    dataType,
    selectedIndices,
    deletionIds
  })
}
