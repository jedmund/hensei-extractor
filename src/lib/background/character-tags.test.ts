import { describe, expect, it } from 'vitest'
import { toCharacterTagData } from './character-tags.js'

describe('toCharacterTagData', () => {
  it('keeps the fields CharacterTags shows', () => {
    expect(
      toCharacterTagData({
        granblue_id: '3040652000',
        element: 4,
        season: 3,
        style_swap: false,
        series: [
          { id: 'x', slug: 'summer', name: { en: 'Summer', ja: '水着' } }
        ],
        name: { en: 'Felluca' }
      })
    ).toEqual({
      element: 4,
      season: 3,
      series: [{ name: { en: 'Summer', ja: '水着' } }],
      styleSwap: false
    })
  })

  it('drops legacy numeric series and missing fields', () => {
    expect(toCharacterTagData({ series: [3], style_swap: true })).toEqual({
      element: null,
      season: null,
      series: [],
      styleSwap: true
    })
    expect(toCharacterTagData(null)).toBeNull()
  })
})
