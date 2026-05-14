<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import type { ParsedSupportSummonPayload, ParsedSupportSummon } from '../../lib/parsers/support-summons.js'

  interface Props {
    data: ParsedSupportSummonPayload
  }

  let { data }: Props = $props()

  // GBF section index → label key.
  // 0=Misc/Null, 1=Fire, 2=Water, 3=Earth, 4=Wind, 5=Light, 6=Dark — GBF's ordering.
  const SECTION_LABEL: Record<number, () => string> = {
    0: m.element_misc,
    1: m.element_fire,
    2: m.element_water,
    3: m.element_earth,
    4: m.element_wind,
    5: m.element_light,
    6: m.element_dark
  }

  function sectionLabel(gbfSection: number): string {
    const fn = SECTION_LABEL[gbfSection]
    return fn ? fn() : `Section ${gbfSection}`
  }

  // GBF asset URL for the summon thumbnail. The HTML uses image-id variants
  // like "2040094000_04" for transcended summons but the base granblue_id is
  // a safe fallback that always renders an image.
  function summonImageUrl(granblueId: string): string {
    return `https://prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/assets/summon/m/${granblueId}.jpg`
  }

  // GBF's section order on the in-game page is misc first, then the six elements.
  const SECTION_ORDER = [0, 1, 2, 3, 4, 5, 6]

  type Group = { gbfSection: number; items: ParsedSupportSummon[] }
  let groups = $derived.by((): Group[] => {
    const bySection = new Map<number, ParsedSupportSummon[]>()
    for (const item of data?.items ?? []) {
      const arr = bySection.get(item.gbf_section) ?? []
      arr.push(item)
      bySection.set(item.gbf_section, arr)
    }
    for (const arr of bySection.values()) {
      arr.sort((a, b) => a.position - b.position)
    }
    return SECTION_ORDER
      .filter((s) => bySection.has(s))
      .map((s) => ({ gbfSection: s, items: bySection.get(s)! }))
  })
</script>

<div class="support-summons-detail">
  {#if data?.gbf_user_id}
    <div class="user-id">{m.support_summons_user_id({ id: data.gbf_user_id })}</div>
  {/if}

  {#each groups as group (group.gbfSection)}
    <section class="section">
      <h3 class="section-label">{sectionLabel(group.gbfSection)}</h3>
      <div class="slots">
        {#each group.items as slot (`${slot.gbf_section}-${slot.position}`)}
          <div class="slot">
            <img class="slot-image" src={summonImageUrl(slot.granblue_id)} alt={slot.granblue_id} />
            <div class="slot-meta">
              <div class="slot-id">{slot.granblue_id}</div>
              <div class="slot-level">Lvl {slot.level}</div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style lang="scss">
  .support-summons-detail {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  .user-id {
    font-size: 0.85rem;
    opacity: 0.7;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    font-size: 0.95rem;
    margin: 0;
  }

  .slots {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .slot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    min-width: 9rem;
  }

  .slot-image {
    width: 40px;
    height: 40px;
    border-radius: 4px;
  }

  .slot-meta {
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
  }

  .slot-id {
    opacity: 0.7;
    font-family: monospace;
    font-size: 0.75rem;
  }
</style>
