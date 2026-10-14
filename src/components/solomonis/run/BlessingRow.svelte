<!-- One equipped Arcarum Blessing: its card, name, level and cost, and what
     it does at that level. Like hensei-web's BlessingRow, with the card art
     in place of the round icon. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import type { DeckBlessing } from '../../../lib/solomonis/blessings.js'

  interface Props {
    blessing: DeckBlessing
  }

  let { blessing }: Props = $props()

  let subtitle = $derived(
    [
      m.solomonis_extension_blessing_level({ level: blessing.level }),
      blessing.cost != null ? m.solomonis_extension_blessing_cost({ cost: blessing.cost }) : null
    ]
      .filter(Boolean)
      .join(' · ')
  )
</script>

<div class="blessing-row">
  <img
    class="card"
    src={getImageUrl(`${BUCKET.blessings}/card-list/${blessing.slug}.png`)}
    alt=""
    loading="lazy"
  />
  <div class="text">
    <span class="name">{blessing.name}</span>
    <span class="subtitle">{subtitle}</span>
    {#if blessing.effect}
      <p class="effect">{blessing.effect}</p>
    {/if}
  </div>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  .blessing-row {
    display: flex;
    align-items: flex-start;
    gap: $unit * 1.5;
  }

  // The card art is 124 × 204
  .card {
    flex-shrink: 0;
    width: 48px;
    aspect-ratio: 124 / 204;
    border-radius: 4px;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding-top: $unit-half;
  }

  .name {
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
  }

  .subtitle {
    font-size: $font-tiny;
    color: var(--color-text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  .effect {
    margin: $unit-half 0 0;
    font-size: $font-tiny;
    color: var(--color-text-tertiary);
  }
</style>
