/**
 * The Arcarum Blessings a captured party deck has equipped, for the side
 * panel. The deck lists every blessing with its level; the equipped ones
 * are `is_used`. Names and effect text are the game's, in the language the
 * deck was captured in.
 */

/** Blessing slugs by arcana number, as in hensei-api's catalogue. */
const SLUGS_BY_ARCANA: Record<number, string> = {
  11: 'justice',
  12: 'hanged_man',
  13: 'death',
  14: 'temperance',
  15: 'devil',
  16: 'tower',
  17: 'star',
  18: 'moon',
  19: 'sun',
  20: 'judgement'
}

/** The deck's blessing_id 1..n is arcana number 11..: Justice is 1. */
const ARCANA_OFFSET = 10

export interface DeckBlessing {
  slug: string
  name: string
  level: number
  maxLevel: number | null
  cost: number | null
  /** What it does at this level, with the game's value filled in */
  effect: string | null
}

export interface DeckBlessings {
  blessings: DeckBlessing[]
  totalCost: number | null
  maxCost: number | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value)
  return value != null && value !== '' && Number.isFinite(number) ? number : null
}

/** The game's effect text: `%s` stands for the level's value. */
function effectText(skillInfo: unknown): string | null {
  if (!isRecord(skillInfo) || typeof skillInfo.text !== 'string') return null
  const value = typeof skillInfo.effect_value === 'string' ? skillInfo.effect_value : ''
  return skillInfo.text.replace('%s', value).replace(/\s+/g, ' ').trim() || null
}

/**
 * The equipped blessings of a party deck response (`{ deck: { blessing,
 * blessing_cost_info } }`), in arcana order. Null when the deck has no
 * blessing list.
 */
export function deckBlessings(party: unknown): DeckBlessings | null {
  const deck = isRecord(party) && isRecord(party.deck) ? party.deck : null
  if (!deck || !isRecord(deck.blessing)) return null

  const blessings = Object.values(deck.blessing)
    .filter(isRecord)
    .filter((entry) => entry.is_used === true || entry.is_used === 1)
    .flatMap((entry): (DeckBlessing & { arcana: number })[] => {
      const id = numberOrNull(entry.blessing_id)
      const arcana = id == null ? NaN : id + ARCANA_OFFSET
      const slug = SLUGS_BY_ARCANA[arcana]
      if (!slug) return []
      return [
        {
          arcana,
          slug,
          name: typeof entry.name === 'string' ? entry.name : slug,
          level: numberOrNull(entry.level) ?? 0,
          maxLevel: numberOrNull(entry.max_level),
          cost: numberOrNull(entry.cost),
          effect: effectText(entry.skill_info)
        }
      ]
    })
    .sort((a, b) => a.arcana - b.arcana)
    .map(({ arcana: _arcana, ...blessing }) => blessing)

  const costInfo = isRecord(deck.blessing_cost_info) ? deck.blessing_cost_info : {}
  return {
    blessings,
    totalCost: numberOrNull(costInfo.total_cost),
    maxCost: numberOrNull(costInfo.max_cost)
  }
}
