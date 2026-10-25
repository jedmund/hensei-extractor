<!-- CharacterTag Component (ported from hensei-svelte): one of a
     character's season, series or style tags, coloured by its element. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { getLocale } from '../../../lib/i18n.js'
  import { gameElementKey } from '../../../lib/game-data.js'
  import type { CharacterTagData } from '../../../lib/types/messages.js'

  type TagType = 'season' | 'series' | 'style'

  interface Props {
    character: CharacterTagData
    type: TagType
    /** Which of the character's series to show */
    seriesIndex?: number
  }

  let { character, type, seriesIndex = 0 }: Props = $props()

  // Seasons as in hensei-web's CharacterSeason
  const SEASONS: Record<number, () => string> = {
    1: m.season_valentine,
    2: m.season_formal,
    3: m.season_summer,
    4: m.season_halloween,
    5: m.season_holiday
  }

  const elementClass = $derived(gameElementKey(character.element) ?? 'neutral')

  const displayText = $derived.by(() => {
    switch (type) {
      case 'season':
        return character.season != null ? (SEASONS[character.season]?.() ?? null) : null
      case 'style':
        return m.tag_style()
      case 'series': {
        const name = character.series[seriesIndex]?.name
        if (!name) return null
        return (getLocale() === 'ja' ? name.ja : name.en) || name.en || name.ja || null
      }
    }
  })
</script>

{#if displayText}
  <span class="character-tag {elementClass}">{displayText}</span>
{/if}

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;

  .character-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px $unit;
    border-radius: $item-corner-small;
    font-size: $font-tiny;
    font-weight: $medium;
    white-space: nowrap;
    line-height: 1;

    // hensei-web's element tag colours (light theme)
    &.wind {
      background-color: #cdffed;
      color: #006a45;
    }

    &.fire {
      background-color: #ffcdcd;
      color: #6e0000;
    }

    &.water {
      background-color: #cdedff;
      color: #00639c;
    }

    &.earth {
      background-color: #ffe2cd;
      color: #8e3c0b;
    }

    &.dark {
      background-color: #f2cdff;
      color: #560075;
    }

    &.light {
      background-color: #fffacd;
      color: #715100;
    }

    &.neutral {
      background-color: #e9e9e9;
      color: #444;
    }
  }
</style>
