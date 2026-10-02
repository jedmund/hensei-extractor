import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities } from './html-entities.js'

describe('decodeHtmlEntities', () => {
  it('decodes the named entities the game escapes', () => {
    expect(decodeHtmlEntities('Fire &gt; Water &amp; Wind &lt;3')).toBe(
      'Fire > Water & Wind <3'
    )
    expect(decodeHtmlEntities('&quot;Team&quot; &apos;A&apos;')).toBe(
      '"Team" \'A\''
    )
  })

  it('decodes decimal and hex character references', () => {
    expect(decodeHtmlEntities('&#39;s team &#x2605;')).toBe("'s team ★")
  })

  it('decodes each entity once, not recursively', () => {
    expect(decodeHtmlEntities('&amp;gt;')).toBe('&gt;')
  })

  it('leaves unknown entities and plain text alone', () => {
    expect(decodeHtmlEntities('A &bogus; B')).toBe('A &bogus; B')
    expect(decodeHtmlEntities('Rock & roll')).toBe('Rock & roll')
    expect(decodeHtmlEntities('日本語の編成')).toBe('日本語の編成')
  })

  it('leaves out-of-range code points alone', () => {
    expect(decodeHtmlEntities('&#x110000;')).toBe('&#x110000;')
  })
})
