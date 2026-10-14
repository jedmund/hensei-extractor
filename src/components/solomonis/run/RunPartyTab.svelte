<!-- The party a run imports: the allies at the end of the expedition as its
     characters, with the weapons and summons of the Evoker's captured party
     deck (the report leaves those out). The sections always show, with
     empty slots until there's a report and a deck, and a picker when several
     of the Evoker's decks were captured. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { app } from '../../../lib/state/app.svelte.js'
  import type { PartyDeckData } from '../../../lib/detail-data.js'
  import type { PartyDeckLookups } from '../../../lib/party-lookups.js'
  import { evokerPortraitUrl } from '../../../lib/solomonis/status.js'
  import type { FormattedCacheStatus } from '../../../lib/types/cache.js'
  import PartyDetail from '../../detail/party/PartyDetail.svelte'
  import Notice from '../../shared/Notice.svelte'
  import Select from '../../shared/Select.svelte'
  import GoToNotice from './GoToNotice.svelte'

  type Deck = FormattedCacheStatus & { dataType: string; evokerId?: string | null }

  interface Props {
    /** The Evoker's captured decks, most recent first */
    decks: Deck[]
    /** The deck the run imports with, or null when none was captured */
    deck: Deck | null
    /** The chosen deck's data and lookups, once loaded */
    party: PartyDeckData | null
    lookups: PartyDeckLookups | null
    /** The allies at the end of the run (image IDs); empty without the expedition log */
    allies: string[]
    /** Whether the Evoker is known (from the expedition log) */
    hasEvoker: boolean
    /** The game page that captures the Evoker's deck, when known */
    page: string | null
  }

  let { decks, deck, party, lookups, allies, hasEvoker, page }: Props = $props()

  let options = $derived(
    decks.map((d) => ({
      value: d.dataType,
      label: d.partyName || d.displayName,
      suffix: d.ageText,
      image: evokerPortraitUrl(d.evokerId) || undefined
    }))
  )
</script>

<section class="run-party" aria-live="polite">
  {#if deck}
    <Notice variant="blue">
      <p>{m.solomonis_extension_note_with_setup({ deck: deck.partyName || deck.displayName })}</p>
    </Notice>
  {:else}
    <GoToNotice
      message={hasEvoker
        ? m.solomonis_extension_note_without_setup()
        : m.solomonis_extension_party_needs_report()}
      {page}
      actionLabel={m.solomonis_extension_go_to_party()}
    />
  {/if}

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
  @use 'themes/spacing' as *;

  .run-party {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }
</style>
