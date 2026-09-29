<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import {
    getPlaceholderImageUrl,
    getSummonImageUrl
  } from '../../lib/images.js'
  import type {
    ParsedSupportSummonPayload,
    ParsedSupportSummon
  } from '../../lib/parsers/support-summons.js'

  interface Props {
    data: ParsedSupportSummonPayload
  }

  let { data }: Props = $props()

  // Elements in GBF's order, with Misc last. Each entry is [GBF section index,
  // label, slot count]; empty slots are shown so the layout matches the game.
  const SECTIONS: Array<[number, () => string, number]> = [
    [1, m.element_fire, 3],
    [2, m.element_water, 3],
    [3, m.element_earth, 3],
    [4, m.element_wind, 3],
    [5, m.element_light, 3],
    [6, m.element_dark, 3],
    [0, m.element_misc, 4]
  ]

  const PLACEHOLDER = getPlaceholderImageUrl('summon', 'main')

  type Slot = { key: string; summon: ParsedSupportSummon | undefined }
  type Group = { label: string; slots: Slot[] }

  let groups = $derived.by((): Group[] => {
    const bySlot = new Map(
      (data?.items ?? []).map((item) => [
        `${item.gbf_section}-${item.position}`,
        item
      ])
    )
    return SECTIONS.map(([section, label, count]) => ({
      label: label(),
      slots: Array.from({ length: count }, (_, position) => {
        const key = `${section}-${position}`
        return { key, summon: bySlot.get(key) }
      })
    }))
  })
</script>

<div class="support-summons-detail">
  {#if data?.gbf_user_id}
    <div class="user-id">{m.support_summons_user_id({ id: data.gbf_user_id })}</div>
  {/if}

  {#each groups as group (group.label)}
    <section class="section">
      <h3 class="section-label">{group.label}</h3>
      <div class="slots">
        {#each group.slots as { key, summon } (key)}
          <div class="slot" class:empty={!summon}>
            {#if summon}
              <img
                class="slot-image"
                src={getSummonImageUrl(summon.granblue_id, 'main', summon.image_id)}
                alt={summon.name ?? summon.granblue_id}
                onerror={(e) => ((e.currentTarget as HTMLImageElement).src = PLACEHOLDER)}
              />
              <div class="slot-name">{summon.name ?? summon.granblue_id}</div>
              <div class="slot-level">
                {summon.level != null
                  ? m.support_summons_level({ level: summon.level })
                  : m.support_summons_level_unknown()}
              </div>
            {:else}
              <img class="slot-image" src={PLACEHOLDER} alt="" />
              <div class="slot-name">{m.support_summons_empty()}</div>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style lang="scss">
  @use 'themes/layout' as *;
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .support-summons-detail {
    display: flex;
    flex-direction: column;
    gap: $unit-2x;
  }

  .user-id {
    font-size: $font-small;
    color: var(--color-text-secondary);
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

  .slots {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $unit;
  }

  .slot {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
    min-width: 0;

    &.empty .slot-name {
      color: var(--color-text-secondary);
    }
  }

  .slot-image {
    display: block;
    width: 100%;
    height: auto;
    border-radius: $item-corner-small;
  }

  .slot-name {
    font-size: $font-small;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slot-level {
    font-size: $font-small;
    color: var(--color-text-secondary);
  }
</style>
