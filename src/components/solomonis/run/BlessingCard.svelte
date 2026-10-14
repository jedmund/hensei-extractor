<!-- One equipped Arcarum Blessing as its card, with its level and cost
     underneath. The card art carries the blessing's name. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import type { DeckBlessing } from '../../../lib/solomonis/blessings.js'

  interface Props {
    blessing: DeckBlessing
  }

  let { blessing }: Props = $props()
</script>

<figure class="blessing-card">
  <img
    class="card"
    src={getImageUrl(`${BUCKET.blessings}/card-list/${blessing.slug}.png`)}
    alt={blessing.name}
    title={blessing.name}
    loading="lazy"
  />
  <figcaption>
    <span class="level">{m.solomonis_extension_blessing_level({ level: blessing.level })}</span>
    {#if blessing.cost != null}
      <span class="cost">{m.solomonis_extension_blessing_cost({ cost: blessing.cost })}</span>
    {/if}
  </figcaption>
</figure>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;

  .blessing-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $unit-half;
    margin: 0;
    min-width: 0;
  }

  // The card art is 124 × 204
  .card {
    display: block;
    width: 100%;
    aspect-ratio: 124 / 204;
    border-radius: 4px;
  }

  figcaption {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-variant-numeric: tabular-nums;
  }

  .level {
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
  }

  .cost {
    font-size: $font-tiny;
    color: var(--color-text-tertiary);
  }
</style>
