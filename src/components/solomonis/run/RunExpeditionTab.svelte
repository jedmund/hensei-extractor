<!-- The expedition log: outcome, pledge, turns and guidebook size, when the
     run ended, and the five allies at the end of it. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import { getCharacterBaseArtUrl } from '../../../lib/images.js'
  import type { SolomonisReport } from '../../../lib/solomonis/types.js'

  interface Props {
    report: SolomonisReport
  }

  let { report }: Props = $props()

  let summary = $derived.by(() => {
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

  let endedAt = $derived(typeof report.ended_at === 'string' ? report.ended_at : null)

  // The five allies at the end of the run, Evoker included, as image IDs
  // (`<granblue_id>_<art>`). Order carries no meaning in this mode.
  let allies = $derived(
    [1, 2, 3, 4, 5]
      .map((n) => report[`npc${n}_image_id`])
      .filter((id): id is string => typeof id === 'string' && /^\d+_\w+$/.test(id))
  )

  function characterImage(imageId: string): string {
    return getImageUrl(`${BUCKET.characterSquare}/${imageId}.jpg`)
  }

  function onImageError(event: Event) {
    const img = event.currentTarget as HTMLImageElement
    const base = getCharacterBaseArtUrl(img.src)
    if (base) img.src = base
  }
</script>

<section class="expedition">
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

<style lang="scss">
  @use 'themes/layout' as *;
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .expedition {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
  }

  .summary-line,
  .summary-ended {
    margin: 0;
    font-size: $font-small;
  }

  .summary-line {
    color: var(--color-text);
    font-weight: $medium;
  }

  .summary-ended {
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
</style>
