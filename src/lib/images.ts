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
 * The game's element IDs (`master.attribute`: 1 Fire, 2 Water, 3 Earth,
 * 4 Wind, 5 Light, 6 Dark) mapped to Hensei's (1 Wind, 2 Fire, 3 Water,
 * 4 Earth, 5 Dark, 6 Light), which image file names use. Same mapping as the
 * API's WeaponProcessor::ELEMENT_MAPPING.
 */
const GAME_TO_HENSEI_ELEMENT: Record<string, number> = {
  '1': 2,
  '2': 3,
  '3': 4,
  '4': 1,
  '5': 6,
  '6': 5
}

export function toHenseiElement(
  gameAttribute: string | number | null | undefined
): number | null {
  return GAME_TO_HENSEI_ELEMENT[String(gameAttribute ?? '')] ?? null
}

const CHARACTER_ART = /_(\d{2})(?:_[a-z0-9]+)*\.jpg$/

/**
 * The base `_01` art for a character image URL, or null when the URL is
 * already the base art. Characters have no suffix-less file, and not every
 * character has art for each pose, so a missing pose falls back to `_01`.
 */
export function getCharacterBaseArtUrl(url: string): string | null {
  const base = url.replace(CHARACTER_ART, '_01.jpg')
  return base !== url ? base : null
}

/**
 * Character art to try, in order, when `url` fails to load. Null-element
 * characters such as SR Lyria follow the party's element and only have
 * element art (`{id}_{pose}_0{element}`), so with a party element those come
 * first: the same pose, then the base pose. The last resort is the `_01` art.
 * Characters with ordinary art never reach these, so they cost no extra
 * requests.
 */
export function getCharacterArtFallbacks(
  url: string,
  henseiElement: number | null = null
): string[] {
  const match = url.match(CHARACTER_ART)
  if (!match) return []
  const pose = match[1]
  const withSuffix = (suffix: string) =>
    url.replace(CHARACTER_ART, `${suffix}.jpg`)

  const candidates = henseiElement
    ? [
        withSuffix(`_${pose}_0${henseiElement}`),
        withSuffix(`_01_0${henseiElement}`),
        withSuffix('_01')
      ]
    : [withSuffix('_01')]

  return [...new Set(candidates)].filter((candidate) => candidate !== url)
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
