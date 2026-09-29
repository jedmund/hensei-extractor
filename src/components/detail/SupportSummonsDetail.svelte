<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { BUCKET, getImageUrl } from '../../lib/constants.js'
  import type {
    ParsedSupportSummonPayload,
    ParsedSupportSummon
  } from '../../lib/parsers/support-summons.js'

  interface Props {
    data: ParsedSupportSummonPayload
  }

  let { data }: Props = $props()

  // GBF's section order on the profile page: misc first, then the six elements.
  const SECTIONS: Array<[number, () => string]> = [
    [0, m.element_misc],
    [1, m.element_fire],
    [2, m.element_water],
    [3, m.element_earth],
    [4, m.element_wind],
    [5, m.element_light],
    [6, m.element_dark]
  ]

  type Group = { label: string; items: ParsedSupportSummon[] }
  let groups = $derived.by((): Group[] => {
    const items = data?.items ?? []
    return SECTIONS.map(([section, label]) => ({
      label: label(),
      items: items
        .filter((item) => item.gbf_section === section)
        .sort((a, b) => a.position - b.position)
    })).filter((group) => group.items.length > 0)
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
        {#each group.items as slot (`${slot.gbf_section}-${slot.position}`)}
          <div class="slot">
            <img
              class="slot-image"
              src={getImageUrl(`${BUCKET.summonSquare}/${slot.granblue_id}.jpg`)}
              alt={slot.name ?? slot.granblue_id}
            />
            <div class="slot-meta">
              <div class="slot-name">{slot.name ?? slot.granblue_id}</div>
              <div class="slot-level">
                {slot.level != null
                  ? m.support_summons_level({ level: slot.level })
                  : m.support_summons_level_unknown()}
              </div>
            </div>
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
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: $unit;
  }

  .slot {
    display: flex;
    align-items: center;
    gap: $unit;
    padding: $unit;
    background: var(--color-bg);
    border-radius: $input-corner;
    min-width: 0;
  }

  .slot-image {
    width: $unit-5x;
    height: $unit-5x;
    border-radius: $item-corner-small;
    object-fit: cover;
    flex-shrink: 0;
  }

  .slot-meta {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
    min-width: 0;
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
