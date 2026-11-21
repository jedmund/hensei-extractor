<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import {
    capturedWonderImage,
    getGameWonderImageUrl,
    getWonderImageUrl
  } from '../../lib/images.js'
  import {
    isWonderActive,
    wonderLevel,
    type WonderCategory
  } from '../../lib/wonders.js'

  interface Props {
    data: WonderCategory[]
  }

  let { data }: Props = $props()

  let categories = $derived(
    (Array.isArray(data) ? data : []).filter(
      (category) => Array.isArray(category.item) && category.item.length > 0
    )
  )

  // Our copy may not be uploaded yet; the game serves the same file.
  function useGameImage(event: Event, image: string) {
    const img = event.currentTarget as HTMLImageElement
    const fallback = getGameWonderImageUrl(image)
    if (img.src !== fallback) img.src = fallback
  }
</script>

<div class="wonders-detail">
  {#each categories as category (category.category_id)}
    <section class="section">
      <h3 class="section-label">{category.name ?? ''}</h3>
      <div class="item-list">
        {#each category.item ?? [] as item (item.item_id)}
          {@const image = capturedWonderImage(item)}
          {@const level = wonderLevel(item)}
          {@const active = isWonderActive(item)}
          <div class="list-item" class:inactive={!active}>
            <img
              class="list-item-image"
              src={getWonderImageUrl(image)}
              alt=""
              onerror={(e) => useGameImage(e, image)}
            />
            <div class="list-item-info">
              <span class="list-item-name">
                {item.name ?? item.item_id}
                {#if level !== null}
                  <span class="list-item-level">Lv.{level}</span>
                {/if}
              </span>
              {#if !active}
                <span class="wonder-state">{m.wonders_inactive()}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style lang="scss">
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .wonders-detail {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: $unit;
  }

  .section-label {
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
    margin: 0;
  }

  // Dimmed like owned items in collection lists
  .inactive {
    > .list-item-image,
    > .list-item-info {
      opacity: 0.35;
    }
  }

  .wonder-state {
    font-size: $font-small;
    color: var(--color-text-secondary);
  }
</style>
