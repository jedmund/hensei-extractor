<!-- The party a run imports with: the Evoker's captured party deck, shown
     as a normal party, with a picker when several of the Evoker's decks
     were captured. The report itself leaves out weapons, summons and
     Blessings, so they come from this deck. -->

<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import * as m from '../../../paraglide/messages.js'
  import { app } from '../../../lib/state/app.svelte.js'
  import type { PartyDeckData } from '../../../lib/detail-data.js'
  import { loadPartyDeckLookups, type PartyDeckLookups } from '../../../lib/party-lookups.js'
  import { getCachedData } from '../../../lib/services/chrome-messages.js'
  import { evokerPortraitUrl } from '../../../lib/solomonis/status.js'
  import type { FormattedCacheStatus } from '../../../lib/types/cache.js'
  import PartyDetail from '../../detail/party/PartyDetail.svelte'
  import Select from '../../shared/Select.svelte'

  type Deck = FormattedCacheStatus & { dataType: string; evokerId?: string | null }

  interface Props {
    /** The Evoker's captured decks, most recent first */
    decks: Deck[]
    /** The deck the run imports with */
    deck: Deck
  }

  let { decks, deck }: Props = $props()

  let options = $derived(
    decks.map((d) => ({
      value: d.dataType,
      label: d.partyName || d.displayName,
      suffix: d.ageText,
      image: evokerPortraitUrl(d.evokerId) || undefined
    }))
  )

  let party = $state<PartyDeckData | null>(null)
  let lookups = $state<PartyDeckLookups | null>(null)
  let failed = $state(false)

  let destroyed = false
  onDestroy(() => {
    destroyed = true
  })

  // Loads the chosen deck, again when it's captured again. A load that's
  // been overtaken, or whose view has gone, drops its results.
  let loadSeq = 0
  $effect(() => {
    const dataType = deck.dataType
    void deck.timestamp
    untrack(() => void load(dataType))
  })

  async function load(dataType: string) {
    const seq = ++loadSeq
    const current = () => !destroyed && seq === loadSeq

    const response = await getCachedData(dataType)
    if (!current()) return
    if (response.error || !response.data) {
      party = null
      failed = true
      return
    }
    failed = false
    party = response.data as PartyDeckData

    const result = await loadPartyDeckLookups(party, { friendSummon: false })
    if (!current()) return
    lookups = result
  }
</script>

<section class="run-party" aria-live="polite">
  {#if decks.length > 1}
    <Select
      label={m.solomonis_extension_setup_label()}
      {options}
      value={deck.dataType}
      onValueChange={(value) => {
        if (value) app.solomonisSetupDataType = value
      }}
      contained
      fullWidth
    />
  {/if}

  <p class="note">
    {m.solomonis_extension_note_with_setup({ deck: deck.partyName || deck.displayName })}
  </p>

  {#if party}
    <PartyDetail
      data={party as Record<string, unknown>}
      weaponKeyMap={lookups?.weaponKeyMap ?? null}
      jobSkillSlugs={lookups?.jobSkillSlugs ?? {}}
      weaponStatModifiers={lookups?.weaponStatModifiers ?? null}
    />
  {:else if failed}
    <p class="note">{m.party_no_data()}</p>
  {/if}
</section>

<style lang="scss">
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .run-party {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }

  .note {
    margin: 0;
    font-size: $font-small;
    color: var(--color-text-secondary);
  }
</style>
