/**
 * A captured party deck, loaded from the cache with the lookups PartyDetail
 * needs. The run view loads one and shares it between its tabs: the Party
 * tab shows its grid, the Expedition tab its Blessings.
 */

import type { PartyDeckData } from '../detail-data.js'
import { loadPartyDeckLookups, type PartyDeckLookups } from '../party-lookups.js'
import { getCachedData } from '../services/chrome-messages.js'

export class CapturedDeck {
  party = $state<PartyDeckData | null>(null)
  lookups = $state<PartyDeckLookups | null>(null)

  #seq = 0
  #disposed = false

  /**
   * Loads a deck by its data type, or clears it for null. A load that's
   * been overtaken by a later one, or that finishes after dispose(), drops
   * its results.
   */
  async load(dataType: string | null): Promise<void> {
    const seq = ++this.#seq
    const current = () => !this.#disposed && seq === this.#seq
    if (!dataType) {
      this.party = null
      this.lookups = null
      return
    }

    const response = await getCachedData(dataType)
    if (!current()) return
    const party = response.error || !response.data ? null : (response.data as PartyDeckData)
    this.party = party
    if (!party) {
      this.lookups = null
      return
    }

    // Evoking Solomonis decks have no support summon to look up
    const lookups = await loadPartyDeckLookups(party, { friendSummon: false })
    if (!current()) return
    this.lookups = lookups
  }

  dispose(): void {
    this.#disposed = true
  }
}
