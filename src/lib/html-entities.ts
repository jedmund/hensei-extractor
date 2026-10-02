/**
 * Decodes the HTML entities the game escapes in player-entered text, such as
 * team names (`A &gt; B`). Runs in the background worker too, where there's no
 * DOMParser, so it decodes by hand.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
}

const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi

function fromCodePoint(codePoint: number, original: string): string {
  // Leave invalid code points as they were rather than throwing.
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return original
  }
  return String.fromCodePoint(codePoint)
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(ENTITY, (match, decimal, hex, name) => {
    if (decimal) return fromCodePoint(Number.parseInt(decimal, 10), match)
    if (hex) return fromCodePoint(Number.parseInt(hex, 16), match)
    return NAMED_ENTITIES[name.toLowerCase()] ?? match
  })
}
