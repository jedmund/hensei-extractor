import { describe, expect, it } from 'vitest'
import deck from './__fixtures__/party-deck.json'
import { deckBlessings } from './blessings.js'

describe('deckBlessings', () => {
  it('lists the equipped blessings in arcana order', () => {
    expect(deckBlessings(deck)).toEqual({
      blessings: [
        {
          slug: 'justice',
          name: 'Justice',
          level: 2,
          maxLevel: 3,
          cost: 60
        },
        {
          slug: 'death',
          name: 'Death',
          level: 8,
          maxLevel: 9,
          cost: 25
        }
      ],
      totalCost: 85,
      maxCost: 100
    })
  })

  it('skips blessings it has no slug for', () => {
    const party = {
      deck: {
        blessing: {
          1: { blessing_id: '99', name: 'New', level: 1, is_used: true }
        }
      }
    }
    expect(deckBlessings(party)?.blessings).toEqual([])
  })

  it('is null without a blessing list', () => {
    expect(deckBlessings({ deck: {} })).toBeNull()
    expect(deckBlessings(null)).toBeNull()
  })
})
