<!-- The party a run imports: the allies at the end of the expedition as its
     characters, with the weapons, summons and Blessings of the Evoker's
     captured party deck (the report leaves those out). The sections always
     show, with empty slots until there's a report and a deck, and a picker
     when several of the Evoker's decks were captured. -->

<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import * as m from '../../../paraglide/messages.js'
  import { app } from '../../../lib/state/app.svelte.js'
  import { openGamePage } from '../../../lib/game-tab.js'
  import type { PartyDeckData } from '../../../lib/detail-data.js'
  import { loadPartyDeckLookups, type PartyDeckLookups } from '../../../lib/party-lookups.js'
  import { getCachedData } from '../../../lib/services/chrome-messages.js'
  import { evokerPortraitUrl } from '../../../lib/solomonis/status.js'
  import type { FormattedCacheStatus } from '../../../lib/types/cache.js'
  import PartyDetail from '../../detail/party/PartyDetail.svelte'
  import Button from '../../shared/Button.svelte'
  import Select from '../../shared/Select.svelte'

  type Deck = FormattedCacheStatus & { dataType: string; evokerId?: string | null }

  interface Props {
    /** The Evoker's captured decks, most recent first */
    decks: Deck[]
    /** The deck the run imports with, or null when none was captured */
    deck: Deck | null
    /** The allies at the end of the run (image IDs); empty without the expedition log */
    allies: string[]
    /** Whether the Evoker is known (from the expedition log) */
    hasEvoker: boolean
    /** The game page that captures the Evoker's deck, when known */
    page: string | null
  }

  let { decks, deck, allies, hasEvoker, page }: Props = $props()

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

  let destroyed = false
  onDestroy(() => {
    destroyed = true
  })

  // Loads the chosen deck, again when it's captured again. A load that's
  // been overtaken, or whose view has gone, drops its results.
  let loadSeq = 0
  $effect(() => {
    const dataType = deck?.dataType ?? null
    void deck?.timestamp
    untrack(() => void load(dataType))
  })

  async function load(dataType: string | null) {
    const seq = ++loadSeq
    const current = () => !destroyed && seq === loadSeq
    if (!dataType) {
      party = null
      lookups = null
      return
    }

    const response = await getCachedData(dataType)
    if (!current()) return
    party = response.error || !response.data ? null : (response.data as PartyDeckData)
    if (!party) return

    const result = await loadPartyDeckLookups(party, { friendSummon: false })
    if (!current()) return
    lookups = result
  }
</script>

<section class="run-party" aria-live="polite">
  {#if decks.length > 1 && deck}
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

  {#if deck}
    <p class="note">
      {m.solomonis_extension_note_with_setup({ deck: deck.partyName || deck.displayName })}
    </p>
  {:else}
    <div class="missing-deck">
      <p class="note">
        {hasEvoker
          ? m.solomonis_extension_note_without_setup()
          : m.solomonis_extension_party_needs_report()}
      </p>
      {#if page}
        <Button variant="raised" size="small" onclick={() => void openGamePage(page)}>
          {m.solomonis_extension_go_to_party()}
        </Button>
      {/if}
    </div>
  {/if}

  <PartyDetail
    data={(party ?? {}) as Record<string, unknown>}
    weaponKeyMap={lookups?.weaponKeyMap ?? null}
    jobSkillSlugs={lookups?.jobSkillSlugs ?? {}}
    weaponStatModifiers={lookups?.weaponStatModifiers ?? null}
    characterImageIds={allies}
    placeholders
    supportSummon={false}
  />
</section>

<style lang="scss">
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .run-party {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }

  .missing-deck {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $unit;
  }

  .note {
    margin: 0;
    font-size: $font-small;
    color: var(--color-text-secondary);
    white-space: pre-line;
  }
</style>
