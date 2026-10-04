/** Shortest time a toast stays on screen. */
export const TOAST_MIN_DURATION_MS = 3000

/** Longest time a toast stays on screen, however long the message. */
export const TOAST_MAX_DURATION_MS = 10000

const BASE_MS = 1500
const MS_PER_CHAR = 60

// Kana, CJK ideographs and full-width forms carry more per character than
// Latin text, so they count double.
const WIDE_CHAR =
  /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u

/**
 * How long a toast should stay visible so there's time to read it: a short
 * message gets the 3 s minimum, longer ones (such as the Japanese import
 * warnings) get more, up to 10 s.
 */
export function toastDuration(message: string): number {
  let weight = 0
  for (const char of message) {
    weight += WIDE_CHAR.test(char) ? 2 : 1
  }
  const duration = BASE_MS + weight * MS_PER_CHAR
  return Math.min(
    TOAST_MAX_DURATION_MS,
    Math.max(TOAST_MIN_DURATION_MS, duration)
  )
}
