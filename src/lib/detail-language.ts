/**
 * Works out which language a captured detail page was in.
 *
 * The game answers detail requests in the player's game language: `name` and
 * `comment` hold that language's text, and Japanese payloads carry the
 * English copies in `name_en` / `comment_en` alongside. The URL doesn't say
 * which language was used, so the text itself is the most reliable signal.
 */

export type PayloadLanguage = 'jp' | 'en'

// Hiragana, katakana, CJK ideographs and half-width katakana
const JAPANESE_TEXT = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ]/
const LATIN_TEXT = /[A-Za-z]/

type Obj = Record<string, unknown>

function asObject(value: unknown): Obj | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Obj)
    : null
}

function nameOf(value: unknown): string | null {
  const name = asObject(value)?.name
  return typeof name === 'string' && name.trim() ? name : null
}

/** Names from a list of skills sent as an object keyed by slot or an array */
function namesIn(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const entries = Array.isArray(value) ? value : Object.values(value)
  return entries.map(nameOf).filter((n): n is string => n !== null)
}

/** The game-text names a detail payload carries, in no particular order */
function gameTextNames(data: Obj): string[] {
  const param = asObject(data.param)
  return [
    nameOf(data.master),
    nameOf(data),
    // Characters
    nameOf(data.special_skill),
    ...namesIn(data.ability),
    ...namesIn(data.support_ability),
    // Weapons (skills may sit at the top level or under param)
    nameOf(data.skill1),
    nameOf(data.skill2),
    nameOf(data.skill3),
    nameOf(param?.skill1),
    nameOf(param?.skill2),
    nameOf(param?.skill3),
    // Summons
    nameOf(data.skill),
    nameOf(data.sub_skill)
  ].filter((n): n is string => n !== null)
}

/**
 * 'jp' when the payload's game text is Japanese, 'en' when it is English,
 * null when there is no game text to judge.
 */
export function detectPayloadLanguage(data: unknown): PayloadLanguage | null {
  const obj = asObject(data)
  if (!obj) return null

  const names = gameTextNames(obj)
  if (names.some((n) => JAPANESE_TEXT.test(n))) return 'jp'
  if (names.some((n) => LATIN_TEXT.test(n))) return 'en'
  return null
}
