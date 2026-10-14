<!-- One expedition report, ready to import as a run. Its three captures are
     tabs: the expedition log, the Evoker's party deck and the guidebook log.
     A tab whose capture is missing offers to open the game page for it. -->

<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { decodeHtmlEntities } from '../../lib/html-entities.js'
  import { matchingDecks, reportEvokerId } from '../../lib/solomonis/deck.js'
  import { deckBlessings } from '../../lib/solomonis/blessings.js'
  import { CapturedDeck } from '../../lib/solomonis/captured-deck.svelte.js'
  import { reportAllies } from '../../lib/solomonis/report-stats.js'
  import { isSolomonisDeckDataType } from '../../lib/solomonis/routes.js'
  import {
    runSteps,
    runTabStep,
    type SolomonisRunTab
  } from '../../lib/solomonis/steps.js'
  import type { SolomonisRunCapture } from '../../lib/solomonis/types.js'
  import DetailScroll from '../detail/DetailScroll.svelte'
  import PartyMeta from '../detail/party/PartyMeta.svelte'
  import RunEmptyTab from './run/RunEmptyTab.svelte'
  import RunExpeditionTab from './run/RunExpeditionTab.svelte'
  import RunGuidebookTab from './run/RunGuidebookTab.svelte'
  import RunPartyTab from './run/RunPartyTab.svelte'
  import RunTabs from './run/RunTabs.svelte'

  interface Props {
    dataType: string
    /** The cached capture, or null until it has loaded */
    data: unknown
    /** Changes whenever DetailView loads a new capture for this view */
    generation: number
    scrolled?: boolean
  }

  let { dataType, data, generation, scrolled = $bindable(false) }: Props = $props()

  let capture = $derived(data as SolomonisRunCapture | null)
  let report = $derived(capture?.report ?? null)

  let tab = $state<SolomonisRunTab>('expedition')

  // The report leaves out weapons, summons and Blessings, so they come from
  // a captured party deck for the Evoker the report was run with: the most
  // recently captured one unless the user picks another.
  let evokerId = $derived(reportEvokerId(report))
  let decks = $derived(
    matchingDecks(
      Object.entries(app.cachedStatus)
        .filter(([type, status]) => isSolomonisDeckDataType(type) && status.available)
        .map(([type, status]) => ({ ...status, dataType: type })),
      evokerId
    )
  )

  $effect(() => {
    const chosen = app.solomonisSetupDataType
    const first = decks[0]?.dataType ?? null
    if (decks.some((deck) => deck.dataType === chosen)) return
    untrack(() => {
      if (app.currentDetailDataType !== dataType) return
      app.solomonisSetupDataType = first
    })
  })

  let chosenDeck = $derived(
    decks.find((deck) => deck.dataType === app.solomonisSetupDataType) ?? null
  )

  // The name field starts as the game's deck name, once. A later capture of
  // the other log doesn't overwrite what the user typed.
  let named = false
  $effect(() => {
    const gen = generation
    const deckName = report?.deck_name
    if (!gen || named || typeof deckName !== 'string') return
    untrack(() => {
      if (app.currentDetailDataType !== dataType) return
      app.partyName = decodeHtmlEntities(deckName).trim()
      named = true
    })
  })

  let steps = $derived(
    capture
      ? runSteps({
          reportId: capture.reportId,
          evokerId,
          hasReport: !!capture.report,
          hasBook: !!capture.statusList,
          hasDeck: !!chosenDeck
        })
      : []
  )
  let page = $derived(runTabStep(steps, tab)?.page ?? null)
  let partyPage = $derived(runTabStep(steps, 'party')?.page ?? null)
  let allies = $derived(reportAllies(report))

  // The chosen deck, loaded once for both tabs that show it, and again when
  // it's captured again
  const capturedDeck = new CapturedDeck()
  onDestroy(() => capturedDeck.dispose())
  $effect(() => {
    const deckDataType = chosenDeck?.dataType ?? null
    void chosenDeck?.timestamp
    untrack(() => void capturedDeck.load(deckDataType))
  })
  let blessings = $derived(deckBlessings(capturedDeck.party))
</script>

<PartyMeta {scrolled} raidSelector={false} />

{#if capture}
  <RunTabs bind:value={tab} {steps} />
{/if}

<DetailScroll bind:scrolled>
  {#if capture}
    {#if tab === 'party'}
      <RunPartyTab
        {decks}
        deck={chosenDeck}
        party={capturedDeck.party}
        lookups={capturedDeck.lookups}
        {allies}
        hasEvoker={!!evokerId}
        page={partyPage}
      />
    {:else if tab === 'expedition'}
      {#if report}
        <RunExpeditionTab {report} hasDeck={!!chosenDeck} {blessings} {partyPage} />
      {:else}
        <RunEmptyTab
          message={m.solomonis_extension_note_needs_report()}
          {page}
          actionLabel={m.solomonis_extension_go_to_report()}
        />
      {/if}
    {:else if capture.statusList}
      <RunGuidebookTab statusList={capture.statusList} />
    {:else}
      <RunEmptyTab
        message={m.solomonis_extension_note_without_book()}
        {page}
        actionLabel={m.solomonis_extension_go_to_book()}
      />
    {/if}
  {/if}
</DetailScroll>
