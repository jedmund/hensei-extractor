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
  <div class="card">
    <img
      src={getImageUrl(`${BUCKET.blessings}/card-list/${blessing.slug}.png`)}
      alt={blessing.name}
      title={blessing.name}
      loading="lazy"
    />
  </div>
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

  // The card art is 124 × 204, with 7px of transparent padding and then a
  // 1px edge on every side. The frame shows only what's inside that edge
  // (108 × 188) and draws its own border and rounded corners.
  .card {
    position: relative;
    width: 100%;
    aspect-ratio: 108 / 188;
    overflow: hidden;
    border-radius: 4px;

    img {
      position: absolute;
      left: calc(-100% * 8 / 108);
      top: calc(-100% * 8 / 188);
      width: calc(100% * 124 / 108);
      height: calc(100% * 204 / 188);
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      border: 1px solid rgba(0, 0, 0, 0.16);
      border-radius: inherit;
      pointer-events: none;
    }
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
