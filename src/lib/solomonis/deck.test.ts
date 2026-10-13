import { describe, expect, it } from 'vitest'
import deckResponse from './__fixtures__/party-deck.json'
import {
  buildPartyImportBody,
  deckEvoker,
  deckPriority,
  matchingDecks,
  reportEvokerId,
  shapeDeck
} from './deck.js'

describe('shapeDeck', () => {
  it('keeps the deck and bullets, and nothing else from the response', () => {
    const deck = shapeDeck(deckResponse)!
    expect(Object.keys(deck).sort()).toEqual(['bullet_info', 'deck'])
    expect(deck.deck.name).toBe('Fraux Party 1')
    expect(deck.deck.blessing).toEqual(deckResponse.deck.blessing)
    expect(deck.deck.pc?.weapons).toEqual(deckResponse.deck.pc.weapons)
  })

  it("removes the player's uid without touching the response", () => {
    const deck = shapeDeck(deckResponse)!
    const param = deck.deck.pc?.param as Record<string, unknown>
    expect(param).not.toHaveProperty('id')
    expect(param.attack).toBe(deckResponse.deck.pc.param.attack)
    expect(JSON.stringify(deck)).not.toContain('12345678')
    expect(deckResponse.deck.pc.param.id).toBe(12345678)
  })

  it('passes an already shaped deck through', () => {
    const deck = shapeDeck(deckResponse)!
    expect(shapeDeck(deck)).toEqual(deck)
  })

  it('needs a deck with a priority', () => {
    expect(shapeDeck(null)).toBeNull()
    expect(shapeDeck({})).toBeNull()
    expect(shapeDeck({ deck: { name: 'x' } })).toBeNull()
    expect(shapeDeck({ deck: { priority: 'abc' } })).toBeNull()
    expect(shapeDeck({ deck: { priority: '31001' } })).not.toBeNull()
  })
})

describe('deckPriority and deckEvoker', () => {
  it('read the priority and the Evoker from the body', () => {
    const deck = shapeDeck(deckResponse)!
    expect(deckPriority(deck)).toBe('31001')
    expect(deckEvoker(deck)).toEqual({ id: '3040161000', name: 'Fraux' })
  })

  it('has no Evoker without a first slot', () => {
    expect(deckEvoker({ deck: { priority: 1, npc: { '1': null } } })).toBeNull()
    expect(deckEvoker({ deck: { priority: 1 } })).toBeNull()
  })
})

describe('reportEvokerId', () => {
  it("reads the Evoker from the report's thumbnail", () => {
    expect(reportEvokerId({ thumbnail_image: '3040169000_04' })).toBe(
      '3040169000'
    )
    expect(reportEvokerId({ thumbnail_image: '3040169000' })).toBe('3040169000')
    expect(reportEvokerId({ thumbnail_image: 'npc_x' })).toBeNull()
    expect(reportEvokerId({})).toBeNull()
    expect(reportEvokerId(null)).toBeNull()
  })
})

describe('matchingDecks', () => {
  const decks = [
    {
      dataType: 'solomonis_deck_31001',
      evokerId: '3040161000',
      lastUpdated: 1
    },
    {
      dataType: 'solomonis_deck_31002',
      evokerId: '3040161000',
      lastUpdated: 3
    },
    { dataType: 'solomonis_deck_32001', evokerId: '3040169000', lastUpdated: 5 }
  ]

  it("keeps the report Evoker's decks, most recent first", () => {
    expect(matchingDecks(decks, '3040161000').map((d) => d.dataType)).toEqual([
      'solomonis_deck_31002',
      'solomonis_deck_31001'
    ])
  })

  it('matches nothing without an Evoker or a captured deck for it', () => {
    expect(matchingDecks(decks, null)).toEqual([])
    expect(matchingDecks(decks, '3040999000')).toEqual([])
  })
})

describe('buildPartyImportBody', () => {
  it('builds the contract body', () => {
    const body = buildPartyImportBody(deckResponse, {
      name: ' Fraux ',
      visibility: 2,
      playlistIds: ['7']
    })!
    expect(body).toEqual({
      kind: 'solomonis_party',
      name: 'Fraux',
      visibility: 2,
      playlist_ids: ['7'],
      solomonis: { deck: shapeDeck(deckResponse) }
    })
    expect(JSON.stringify(body)).not.toContain('12345678')
  })

  it('strips the uid again from whatever the cache holds', () => {
    const body = buildPartyImportBody({
      deck: { priority: 1, pc: { param: { id: 12345678, hp: 1 } } }
    })!
    expect(body.solomonis.deck.deck.pc).toEqual({ param: { hp: 1 } })
    expect(body.playlist_ids).toEqual([])
    expect(body).not.toHaveProperty('name')
  })

  it('returns null for anything that is not a deck', () => {
    expect(buildPartyImportBody({})).toBeNull()
  })
})
