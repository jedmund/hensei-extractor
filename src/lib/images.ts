/**
 * Image URL helpers, mirroring hensei-web's src/lib/utils/images.ts.
 *
 * The site derives alt-art suffixes (_02/_03/_04) from uncap level because
 * that's all it stores. The extension sees the game's own image ID
 * (param.image_id, data-image-id), so the suffix is taken from that instead.
 */
import { BUCKET, getImageUrl } from './constants.js'
import { resolveForgedSummonId } from './game-data.js'

export type SummonImageVariant = 'main' | 'grid' | 'square' | 'tall'
export type PlaceholderType = 'character' | 'weapon' | 'summon'

const SUMMON_BUCKETS: Record<SummonImageVariant, string> = {
  main: BUCKET.summonMain,
  grid: BUCKET.summonGrid,
  square: BUCKET.summonSquare,
  tall: BUCKET.summonTall
}

/**
 * The alt-art suffix the game encodes in an image ID, e.g. "_04" for
 * ("2040094000", "2040094000_04"). Empty when there's no image ID or it
 * doesn't belong to this item.
 */
export function getImageIdSuffix(
  granblueId: string | number | null | undefined,
  imageId: string | null | undefined
): string {
  if (!granblueId || !imageId) return ''
  const id = String(granblueId)
  return imageId.startsWith(id) ? imageId.slice(id.length) : ''
}

/** Same naming as the site: app/placeholders/placeholder-{type}-{variant}.png */
export function getPlaceholderImageUrl(
  type: PlaceholderType,
  variant: string
): string {
  return getImageUrl(
    `${BUCKET.placeholders}/placeholder-${type}-${variant}.png`
  )
}

/**
 * Summon art for a variant, with the uncap suffix from the game's image ID.
 * Forged summon IDs resolve to their base art. No ID gives the placeholder.
 */
export function getSummonImageUrl(
  granblueId: string | number | null | undefined,
  variant: SummonImageVariant = 'main',
  imageId?: string | null
): string {
  if (!granblueId) return getPlaceholderImageUrl('summon', variant)
  const suffix = getImageIdSuffix(granblueId, imageId)
  const id = resolveForgedSummonId(String(granblueId))
  return getImageUrl(`${SUMMON_BUCKETS[variant]}/${id}${suffix}.jpg`)
}

export type ElementIconKey =
  | 'fire'
  | 'water'
  | 'earth'
  | 'wind'
  | 'light'
  | 'dark'
  | 'null'

/** Round element icon, same file as hensei-web's getElementImage. */
export function getElementIconUrl(key: ElementIconKey): string {
  return getImageUrl(`${BUCKET.elements}/${key}.png`)
}
