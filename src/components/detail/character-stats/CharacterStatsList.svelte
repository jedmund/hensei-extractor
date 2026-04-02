<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getImageUrl } from '../../../lib/constants.js'
  import { GAME_ELEMENT_NAMES } from '../../../lib/game-data.js'
  import {
    formatModifier,
    formatPerpetuityBonus,
    OVER_MASTERY_NAMES,
    AETHERIAL_NAMES
  } from '../../../lib/mastery.js'
  import * as m from '../../../paraglide/messages.js'

  interface Props {
    data: Record<string, any>
  }

  let { data }: Props = $props()

  let characters = $derived.by(() => {
    const chars = Object.values(data)
    return chars.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0))
  })

  const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7139 4.04764C13.14 3.52854 13.0837 2.74594 12.5881 2.29964C12.0925 1.85335 11.3453 1.91237 10.9192 2.43147L5.28565 9.94404L3.02018 7.32366C2.55804 6.83959 1.80875 6.83959 1.34661 7.32366C0.884464 7.80772 0.884464 8.59255 1.34661 9.07662L4.50946 12.6369C4.9716 13.121 5.72089 13.121 6.18303 12.6369C6.2359 12.5816 6.28675 12.5271 6.33575 12.4674L12.7139 4.04764Z"/></svg>`

  // Initialize all items as selected
  $effect(() => {
    if (characters.length > 0 && app.selectedItems.size === 0) {
      app.selectedItems = new Set(characters.map((_: any, i: number) => i))
    }
  })

  function toggleItem(index: number, e: MouseEvent) {
    e.stopPropagation()
    const next = new Set(app.selectedItems)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    app.selectedItems = next
  }

  function getRingLines(char: any): string[] {
    if (!char.rings || char.rings.length === 0) return []
    return char.rings
      .map((ring: any) => formatModifier(ring, OVER_MASTERY_NAMES))
      .filter(Boolean)
  }

  function getEarringLine(char: any): string | null {
    if (!char.earring) return null
    return formatModifier(char.earring, AETHERIAL_NAMES)
  }

  function getPerpetBonusLines(char: any): string[] {
    if (!char.perpetuityBonuses || char.perpetuityBonuses.length === 0) return []
    return char.perpetuityBonuses
      .map((b: any) => formatPerpetuityBonus(b))
      .filter(Boolean)
  }

  function hasStats(char: any): boolean {
    return !!(
      char.awakening ||
      char.perpetuity ||
      (char.rings && char.rings.length > 0) ||
      char.earring ||
      (char.perpetuityBonuses && char.perpetuityBonuses.length > 0)
    )
  }
</script>

{#if characters.length === 0}
  <p class="cache-empty">{m.char_stats_no_captured()}</p>
{:else}
  <div class="char-stats-list">
    {#each characters as char, index (char.masterId)}
      {@const elementName = char.element ? (GAME_ELEMENT_NAMES as Record<string, string>)[char.element] : null}
      {@const ringLines = getRingLines(char)}
      {@const earringLine = getEarringLine(char)}
      {@const perpetBonuses = getPerpetBonusLines(char)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="char-stats-item selectable"
        data-index={index}
        data-master-id={char.masterId}
      >
        <div class="char-stats-header">
          <label
            class="item-checkbox"
            class:checked={app.selectedItems.has(index)}
            data-index={index}
            onclick={(e) => toggleItem(index, e)}
          >
            <span class="checkbox-indicator">{@html CHECK_ICON}</span>
          </label>
          <div class="char-stats-name-row">
            <span class="char-stats-name">{char.masterName || `Character ${char.masterId}`}</span>
            {#if elementName}
              <img
                class="char-stats-element"
                src={getImageUrl(`labels/element/Label_Element_${elementName}.png`)}
                alt={elementName}
              />
            {/if}
          </div>
          <div class="char-stats-image-wrapper">
            <img
              class="char-stats-image"
              src={getImageUrl(`character-square/${char.masterId}_01.jpg`)}
              alt=""
            />
            {#if char.perpetuity}
              <img
                class="char-stats-perpetuity"
                src="icons/perpetuity/filled.svg"
                alt={m.stat_perpetuity_ring()}
                title={m.stat_perpetuity_ring()}
              />
            {/if}
          </div>
        </div>
        <div class="char-stats-body">
          {#if char.awakening || char.perpetuity}
            <div class="char-stats-awakening">
              {#if char.awakening}
                {char.awakening.typeName || m.stat_awakening()} Lv.{char.awakening.level || 1}
                {#if char.perpetuity}
                  {' '}&middot; {m.stat_perpetuity_ring()}
                {/if}
              {:else if char.perpetuity}
                {m.stat_perpetuity_ring()}
              {/if}
            </div>
          {/if}

          {#if ringLines.length > 0}
            <div class="char-stats-section">
              <div class="char-stats-subheader">{m.char_over_mastery()}</div>
              {#each ringLines as line}
                <div class="char-stats-line">{line}</div>
              {/each}
            </div>
          {/if}

          {#if earringLine}
            <div class="char-stats-section">
              <div class="char-stats-subheader">{m.char_aetherial_mastery()}</div>
              <div class="char-stats-line">{earringLine}</div>
            </div>
          {/if}

          {#if perpetBonuses.length > 0}
            <div class="char-stats-section">
              <div class="char-stats-subheader">{m.char_perpetuity_bonuses()}</div>
              {#each perpetBonuses as line}
                <div class="char-stats-line">{line}</div>
              {/each}
            </div>
          {/if}

          {#if !hasStats(char)}
            <div class="char-stats-empty">{m.char_stats_no_stats()}</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
