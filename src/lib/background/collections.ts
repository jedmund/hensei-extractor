import { getSiteBaseUrl } from '../constants.js'
import { authenticatedPost, getAuthToken } from './api-client.js'
import { invalidateCollectionIdsCache } from './reference-data.js'
import type {
  CharacterStatsEntry,
  ConflictCheckResult,
  GameFilter,
  PageData,
  SyncPreviewResult,
  UpdateCheckResult,
  UploadCollectionOptions,
  UploadCollectionResult,
  UploadDetailResult,
  UploadPartyResult
} from './types.js'

export function collectPageItems(
  pagesData: Record<number, PageData>
): unknown[] {
  const items: unknown[] = []
  for (const pageData of Object.values(pagesData)) {
    if (pageData?.list && Array.isArray(pageData.list)) {
      items.push(...pageData.list)
    }
  }
  return items
}

const ENDPOINT_MAP: Record<string, string> = {
  detail_npc: 'characters',
  detail_weapon: 'weapons',
  detail_summon: 'summons',
  collection_weapon: 'weapons',
  collection_npc: 'characters',
  collection_summon: 'summons',
  collection_artifact: 'artifacts',
  list_weapon: 'weapons',
  list_npc: 'characters',
  list_summon: 'summons'
}

export function resolveEndpoint(dataType: string): string | null {
  if (ENDPOINT_MAP[dataType]) return ENDPOINT_MAP[dataType]!
  if (dataType.startsWith('stash_weapon')) return 'weapons'
  if (dataType.startsWith('stash_summon')) return 'summons'
  if (dataType.startsWith('detail_weapon')) return 'weapons'
  if (dataType.startsWith('detail_summon')) return 'summons'
  if (dataType.startsWith('detail_npc')) return 'characters'
  return null
}

export async function uploadPartyData(
  data: unknown,
  raidId?: string,
  playlistIds?: string[],
  name?: string,
  visibility?: number,
  shareWithCrew?: boolean
): Promise<UploadPartyResult> {
  const body: Record<string, unknown> = { import: data }
  if (raidId) body.raid_id = raidId
  if (playlistIds && playlistIds.length > 0) body.playlist_ids = playlistIds
  if (name) body.name = name
  if (visibility) body.visibility = visibility

  const result = await authenticatedPost('/import', body)
  if (result.error) return result

  if (shareWithCrew && result.data?.party_id) {
    await authenticatedPost(
      `/parties/${result.data.party_id}/shares`,
      {}
    ).catch(() => {})
  }

  const siteUrl = await getSiteBaseUrl()
  return {
    success: true,
    shortcode: result.data!.shortcode as string,
    url: `${siteUrl}/teams/${result.data!.shortcode}`
  }
}

export async function uploadDetailData(
  data: Record<string, unknown>,
  dataType: string
): Promise<UploadDetailResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: `Unknown data type: ${dataType}` }

  const auth = await getAuthToken()
  let lang = 'en'
  if (data.cjs && (data.cjs as string).includes('_jp/')) {
    lang = 'jp'
  } else if (auth?.language === 'ja') {
    lang = 'jp'
  }

  const result = await authenticatedPost(
    `/import/${endpoint}?lang=${lang}`,
    data
  )
  if (result.error) return { error: result.error }
  return { success: true, ...result.data }
}

export function parseGameFilter(
  options: Record<string, unknown>
): GameFilter | null {
  const filter = options.filter as Record<string, string> | undefined
  if (!filter) return null

  const result: GameFilter = { elements: null, proficiencies: null }

  const elementStr = filter['6']
  if (elementStr && typeof elementStr === 'string' && elementStr !== '000000') {
    result.elements = []
    const elementMap = [2, 3, 4, 1, 6, 5]
    for (let i = 0; i < elementStr.length; i++) {
      if (elementStr[i] === '1') {
        result.elements.push(elementMap[i]!)
      }
    }
    if (result.elements.length === 0) result.elements = null
  }

  const profMap = [1, 2, 4, 3, 6, 9, 7, 5, 8, 10]
  const profStr = filter['8']
  if (profStr && typeof profStr === 'string' && profStr !== '0000000000') {
    result.proficiencies = []
    for (let i = 0; i < profStr.length; i++) {
      if (profStr[i] === '1') {
        result.proficiencies.push(profMap[i]!)
      }
    }
    if (result.proficiencies.length === 0) result.proficiencies = null
  }

  if (!result.elements && !result.proficiencies) return null
  return result
}

export function extractFilterFromPages(
  pagesData: Record<number, PageData>
): GameFilter | null {
  for (const pageData of Object.values(pagesData)) {
    if (pageData?.options?.filter || pageData?.option?.filter) {
      const options = (pageData.options ?? pageData.option) as Record<
        string,
        unknown
      >
      return parseGameFilter(options)
    }
  }
  return null
}

export async function previewSyncDeletions(
  pagesData: Record<number, PageData>,
  dataType: string
): Promise<SyncPreviewResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  const activeFilter = extractFilterFromPages(pagesData)
  const result = await authenticatedPost(
    `/collection/${endpoint}/preview_sync`,
    {
      data: { list: allItems },
      filter: activeFilter
    }
  )
  if (result.error) return { error: result.error }
  return {
    willDelete: (result.data!.will_delete as unknown[]) ?? [],
    count: (result.data!.count as number) ?? 0
  }
}

export async function checkConflicts(
  pagesData: Record<number, PageData>,
  dataType: string
): Promise<ConflictCheckResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  const result = await authenticatedPost(
    `/collection/${endpoint}/check_conflicts`,
    { data: { list: allItems } }
  )
  if (result.error) return { error: result.error }
  return { conflicts: (result.data!.conflicts as unknown[]) ?? [] }
}

export async function checkCollectionUpdates(
  pagesData: Record<number, PageData>,
  dataType: string
): Promise<UpdateCheckResult> {
  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  const allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  const result = await authenticatedPost(
    `/collection/${endpoint}/check_updates`,
    { data: { list: allItems } }
  )
  if (result.error) return { error: result.error }
  return { updates: (result.data!.updates as unknown[]) ?? [] }
}

export function characterStatsToItems(
  statsData: Record<string, CharacterStatsEntry>
): Record<string, unknown>[] {
  return Object.values(statsData).map((character) => {
    const item: Record<string, unknown> = {
      granblue_id: character.masterId
    }

    if (character.uncapLevel !== undefined) {
      item.uncap_level = character.uncapLevel
    }
    if (character.transcendenceStep !== undefined) {
      item.transcendence_step = character.transcendenceStep
    }

    if (character.awakening) {
      item.awakening_type = character.awakening.type
      item.awakening_level = character.awakening.level
    }

    if (character.rings && character.rings.length > 0) {
      character.rings.forEach((ring, index) => {
        if (ring?.modifier) {
          item[`ring${index + 1}`] = {
            modifier: ring.modifier,
            strength: ring.strength
          }
        }
      })
    }

    if (character.earring?.modifier) {
      item.earring = {
        modifier: character.earring.modifier,
        strength: character.earring.strength
      }
    }

    if (character.perpetuity !== undefined) {
      item.perpetuity = character.perpetuity
    }

    return item
  })
}

export async function checkCharacterStatsUpdates(
  statsData: Record<string, CharacterStatsEntry>
): Promise<UpdateCheckResult> {
  const items = characterStatsToItems(statsData)
  if (items.length === 0) return { error: 'no_items' }

  const result = await authenticatedPost(
    '/collection/characters/check_updates',
    { data: { list: items } }
  )
  if (result.error) return { error: result.error }
  return { updates: (result.data!.updates as unknown[]) ?? [] }
}

export async function uploadCollectionData(
  pagesData: Record<number, PageData>,
  dataType: string,
  options: UploadCollectionOptions = {}
): Promise<UploadCollectionResult> {
  const {
    updateExisting = false,
    isFullInventory = false,
    reconcileDeletions = false,
    conflictResolutions = null,
    selectedIndices,
    deletionIds
  } = options

  const endpoint = resolveEndpoint(dataType)
  if (!endpoint) return { error: 'unknown_type' }

  let allItems = collectPageItems(pagesData)
  if (allItems.length === 0) return { error: 'no_items' }

  if (selectedIndices && selectedIndices.length > 0) {
    allItems = selectedIndices
      .filter((index) => index >= 0 && index < allItems.length)
      .map((index) => allItems[index]!)
  }

  const activeFilter = extractFilterFromPages(pagesData)
  const body: Record<string, unknown> = {
    data: { list: allItems },
    update_existing: updateExisting,
    is_full_inventory: isFullInventory,
    reconcile_deletions: reconcileDeletions,
    filter: activeFilter
  }

  if (conflictResolutions) {
    body.conflict_resolutions = conflictResolutions
  }
  if (deletionIds && deletionIds.length > 0) {
    body.deletion_ids = deletionIds
  }

  const result = await authenticatedPost(`/collection/${endpoint}/import`, body)
  if (result.error) return { error: result.error }

  invalidateCollectionIdsCache()

  return {
    success: result.data!.success as boolean,
    created: (result.data!.created as number) ?? 0,
    updated: (result.data!.updated as number) ?? 0,
    skipped: (result.data!.skipped as number) ?? 0,
    errors: (result.data!.errors as unknown[]) ?? [],
    reconciliation: result.data!.reconciliation ?? null
  }
}

export async function uploadCharacterStats(
  statsData: Record<string, CharacterStatsEntry>
): Promise<UploadCollectionResult> {
  const items = characterStatsToItems(statsData)

  if (items.length === 0) {
    return { error: 'no_items' }
  }

  const result = await authenticatedPost('/collection/characters/import', {
    data: { list: items },
    update_existing: true
  })
  if (result.error) return { error: result.error }

  invalidateCollectionIdsCache()

  return {
    success: result.data!.success as boolean,
    created: (result.data!.created as number) ?? 0,
    updated: (result.data!.updated as number) ?? 0,
    skipped: (result.data!.skipped as number) ?? 0,
    errors: (result.data!.errors as unknown[]) ?? []
  }
}
