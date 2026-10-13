<script lang="ts">
  import { untrack } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { BUCKET, getImageUrl } from '../../lib/constants.js'
  import { decodeHtmlEntities } from '../../lib/html-entities.js'
  import { getCharacterBaseArtUrl } from '../../lib/images.js'
  import { matchingDecks, reportEvokerId } from '../../lib/solomonis/deck.js'
  import { isSolomonisDeckDataType } from '../../lib/solomonis/routes.js'
  import { evokerPortraitUrl } from '../../lib/solomonis/status.js'
  import { runImportPlan, runSteps } from '../../lib/solomonis/steps.js'
  import type { SolomonisRunCapture } from '../../lib/solomonis/types.js'
  import DetailScroll from '../detail/DetailScroll.svelte'
  import PartyMeta from '../detail/party/PartyMeta.svelte'
  import Select from '../shared/Select.svelte'
  import SolomonisSteps from './SolomonisSteps.svelte'

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

  let deckOptions = $derived(
    decks.map((deck) => ({
      value: deck.dataType,
      label: deck.partyName || deck.displayName,
      suffix: deck.ageText,
      image: evokerPortraitUrl(deck.evokerId) || undefined
    }))
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

  let summary = $derived.by(() => {
    if (!report) return []
    const parts: string[] = []
    if (typeof report.is_success === 'boolean') {
      parts.push(
        report.is_success
          ? m.solomonis_extension_outcome_cleared()
          : m.solomonis_extension_outcome_failed()
      )
    }
    const pledge = report.difficulty
    if (typeof pledge === 'number') {
      parts.push(
        pledge > 0
          ? m.solomonis_extension_pledge({ level: pledge })
          : m.solomonis_extension_no_pledge()
      )
    }
    const turns = Number(report.total_turn)
    if (report.total_turn != null && Number.isFinite(turns)) {
      parts.push(m.solomonis_extension_turns({ count: turns }))
    }
    if (typeof report.spacebook_status_count === 'number') {
      parts.push(
        m.solomonis_extension_guidebook_stacks({
          count: report.spacebook_status_count
        })
      )
    }
    return parts
  })

  let endedAt = $derived(
    typeof report?.ended_at === 'string' ? report.ended_at : null
  )

  // The five allies at the end of the run, Evoker included, as image IDs
  // (`<granblue_id>_<art>`). Order carries no meaning in this mode.
  let allies = $derived.by(() => {
    if (!report) return []
    return [1, 2, 3, 4, 5]
      .map((n) => report[`npc${n}_image_id`])
      .filter((id): id is string => typeof id === 'string' && /^\d+_\w+$/.test(id))
  })

  function characterImage(imageId: string): string {
    return getImageUrl(`${BUCKET.characterSquare}/${imageId}.jpg`)
  }

  function onImageError(event: Event) {
    const img = event.currentTarget as HTMLImageElement
    const base = getCharacterBaseArtUrl(img.src)
    if (base) img.src = base
  }

  // The run's three captures, with a way to the game page for each one
  // still missing, and what an import would go ahead without.
  let steps = $derived(
    capture
      ? runSteps({
          reportId: capture.reportId,
          hasReport: !!capture.report,
          hasBook: !!capture.statusList,
          hasDeck: !!chosenDeck
        })
      : []
  )
  let plan = $derived(runImportPlan(steps))
</script>

<PartyMeta {scrolled} raidSelector={false} />

<DetailScroll bind:scrolled>
  {#if capture}
    <div class="solomonis-run">
      {#if report}
        <section class="summary">
          {#if summary.length > 0}
            <p class="summary-line">{summary.join(' · ')}</p>
          {/if}
          {#if endedAt}
            <p class="summary-ended">{m.solomonis_extension_ended({ date: endedAt })}</p>
          {/if}
          {#if allies.length > 0}
            <h3 class="section-label">{m.solomonis_extension_party_label()}</h3>
            <div class="allies">
              {#each allies as imageId (imageId)}
                <img class="ally" src={characterImage(imageId)} alt="" onerror={onImageError} />
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <SolomonisSteps {steps} />

      <section class="setup" aria-live="polite">
        {#if decks.length > 1}
          <Select
            label={m.solomonis_extension_setup_label()}
            options={deckOptions}
            value={app.solomonisSetupDataType ?? undefined}
            onValueChange={(value) => {
              if (value) app.solomonisSetupDataType = value
            }}
            contained
            fullWidth
          />
        {/if}
        {#if plan.blocking.includes('report')}
          <p class="note">{m.solomonis_extension_note_needs_report()}</p>
        {/if}
        {#if plan.without.includes('book')}
          <p class="note">{m.solomonis_extension_note_without_book()}</p>
        {/if}
        <p class="note">
          {chosenDeck
            ? m.solomonis_extension_note_with_setup({
                deck: chosenDeck.partyName || chosenDeck.displayName
              })
            : m.solomonis_extension_note_without_setup()}
        </p>
      </section>
    </div>
  {/if}
</DetailScroll>

<style lang="scss">
  @use 'themes/layout' as *;
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .solomonis-run {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
  }

  .summary-line,
  .summary-ended,
  .note {
    margin: 0;
    font-size: $font-small;
  }

  .summary-line {
    color: var(--color-text);
    font-weight: $medium;
  }

  .summary-ended,
  .note {
    color: var(--color-text-secondary);
  }

  .section-label {
    margin: $unit 0 0;
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
  }

  .allies {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: $unit-half;
  }

  .ally {
    display: block;
    width: 100%;
    height: auto;
    border-radius: $item-corner-small;
  }

  .setup {
    display: flex;
    flex-direction: column;
    gap: $unit;
  }
</style>
