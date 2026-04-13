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
  import Icon from '../../shared/Icon.svelte'
  import Tooltip from '../../shared/Tooltip.svelte'

  interface MasteryModifier {
    modifier: number
    strength: number | string
    typeName?: string
  }

  interface CharacterStatsEntry {
    masterId?: string
    masterName?: string
    element?: string
    timestamp?: number
    awakening?: { typeName?: string; level?: number } | null
    perpetuity?: boolean
    rings?: MasteryModifier[]
    earring?: MasteryModifier | null
    perpetuityBonuses?: MasteryModifier[]
  }

  interface Props {
    data: Record<string, CharacterStatsEntry>
  }

  let { data }: Props = $props()

  let characters = $derived.by(() => {
    const chars = Object.values(data)
    return chars.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  })


  // Initialize all items as selected
  $effect(() => {
    if (characters.length > 0 && app.selectedItems.size === 0) {
      app.selectedItems = new Set(characters.map((_, i) => i))
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

  function getRingLines(char: CharacterStatsEntry): string[] {
    if (!char.rings || char.rings.length === 0) return []
    return char.rings
      .map((ring) => formatModifier(ring, OVER_MASTERY_NAMES))
      .filter((line): line is string => line !== null)
  }

  function getEarringLine(char: CharacterStatsEntry): string | null {
    if (!char.earring) return null
    return formatModifier(char.earring, AETHERIAL_NAMES)
  }

  function getPerpetBonusLines(char: CharacterStatsEntry): string[] {
    if (!char.perpetuityBonuses || char.perpetuityBonuses.length === 0) return []
    return char.perpetuityBonuses
      .map((b) => formatPerpetuityBonus(b))
      .filter((line): line is string => line !== null)
  }

  function hasStats(char: CharacterStatsEntry): boolean {
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
            <span class="checkbox-indicator"><Icon name="check" size={14} /></span>
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
              <Tooltip content={m.stat_perpetuity_ring()}><img
                class="char-stats-perpetuity"
                src="icons/perpetuity/filled.svg"
                alt={m.stat_perpetuity_ring()}
              /></Tooltip>
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
