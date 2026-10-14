<!-- One character's captured stats as a card: portrait, name and tags in
     the header, then its awakening, Perpetuity Ring, rings and earring as
     label/value rows. Until its Character Bonuses screen has been captured,
     the card offers a button to open it; after that, a smaller one in the
     header refreshes it. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import { characterBonusesPage, openGamePage } from '../../../lib/game-tab.js'
  import {
    AETHERIAL_NAMES,
    formatPerpetuityBonus,
    modifierParts,
    OVER_MASTERY_NAMES,
    PERPETUITY_BONUSES
  } from '../../../lib/mastery.js'
  import type { CharacterTagData } from '../../../lib/types/messages.js'
  import Button from '../../shared/Button.svelte'
  import DetailRow from '../../shared/details/DetailRow.svelte'
  import DetailsSection from '../../shared/details/DetailsSection.svelte'
  import Icon from '../../shared/Icon.svelte'
  import CharacterTags from '../../shared/tags/CharacterTags.svelte'
  import Tooltip from '../../shared/Tooltip.svelte'

  interface MasteryModifier {
    modifier: number
    strength: number | string
    typeName?: string
  }

  export interface CharacterStatsEntry {
    masterId?: string
    masterName?: string
    timestamp?: number
    awakening?: { typeName?: string; level?: number } | null
    perpetuity?: boolean
    rings?: MasteryModifier[]
    earring?: MasteryModifier | null
    bonusesCapturedAt?: number
  }

  interface Props {
    character: CharacterStatsEntry
    tags: CharacterTagData | null
    selected: boolean
    onToggle: (event: MouseEvent) => void
  }

  let { character, tags, selected, onToggle }: Props = $props()

  let rings = $derived(
    (character.rings ?? [])
      .map((ring) => modifierParts(ring, OVER_MASTERY_NAMES))
      .filter((row) => row !== null)
  )
  let earring = $derived(character.earring ? modifierParts(character.earring, AETHERIAL_NAMES) : null)

  // The Perpetuity Ring's bonuses are the same for every character with it
  let perpetuityBonuses = $derived(
    PERPETUITY_BONUSES.map((bonus) => formatPerpetuityBonus(bonus))
      .filter((line) => line !== null)
      .join(' · ')
  )

  let awakening = $derived(
    character.awakening
      ? `${character.awakening.typeName || m.stat_awakening()} Lv.${character.awakening.level || 1}`
      : null
  )
  let hasRows = $derived(
    !!awakening || !!character.perpetuity || rings.length > 0 || !!earring
  )

  // Older captures have no bonusesCapturedAt, but rings or an earring mean
  // the screen was opened
  let bonusesCaptured = $derived(
    !!character.bonusesCapturedAt || rings.length > 0 || !!earring
  )

  function openBonuses() {
    if (character.masterId) void openGamePage(characterBonusesPage(character.masterId))
  }
</script>

<article class="char-card" class:selected>
  <header class="card-header">
    <div class="portrait">
      <img
        src={getImageUrl(`${BUCKET.characterSquare}/${character.masterId}_01.jpg`)}
        alt=""
      />
      {#if character.perpetuity}
        <Tooltip content={m.stat_perpetuity_ring()}>
          <img class="perpetuity-badge" src="icons/perpetuity/filled.svg" alt={m.stat_perpetuity_ring()} />
        </Tooltip>
      {/if}
    </div>
    <div class="identity">
      <span class="name">{character.masterName || `Character ${character.masterId}`}</span>
      {#if tags}
        <CharacterTags character={tags} />
      {/if}
    </div>
    <div class="header-actions">
      {#if bonusesCaptured && character.masterId}
        <Tooltip content={m.char_go_to_bonuses()}>
          <Button
            variant="ghost"
            size="small"
            iconOnly
            aria-label={m.char_go_to_bonuses()}
            onclick={openBonuses}
          >
            <Icon name="refresh" size={14} />
          </Button>
        </Tooltip>
      {/if}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <label class="item-checkbox" class:checked={selected} onclick={onToggle}>
        <span class="checkbox-indicator"><Icon name="check" size={14} /></span>
      </label>
    </div>
  </header>

  {#if hasRows}
    <div class="card-body">
      {#if awakening || character.perpetuity}
        <div class="rows">
          {#if awakening}
            <DetailRow label={m.stat_awakening()} value={awakening} />
          {/if}
          {#if character.perpetuity}
            <DetailRow label={m.stat_perpetuity_ring()}>
              <Tooltip content={perpetuityBonuses}>
                <span class="perpetuity-check" aria-label={perpetuityBonuses}>
                  <Icon name="check" size={14} />
                </span>
              </Tooltip>
            </DetailRow>
          {/if}
        </div>
      {/if}
      {#if rings.length > 0}
        <DetailsSection title={m.char_over_mastery()}>
          <div class="rows">
            {#each rings as ring, index (index)}
              <DetailRow label={ring.label} value={ring.value} />
            {/each}
          </div>
        </DetailsSection>
      {/if}
      {#if earring}
        <DetailsSection title={m.char_aetherial_mastery()}>
          <DetailRow label={earring.label} value={earring.value} />
        </DetailsSection>
      {/if}
    </div>
  {/if}

  {#if !bonusesCaptured && character.masterId}
    <div class="card-missing">
      <p>{m.char_bonuses_not_captured()}</p>
      <Button variant="raised" size="small" onclick={openBonuses}>
        {m.char_go_to_bonuses()}
      </Button>
    </div>
  {/if}
</article>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;

  .char-card {
    display: flex;
    flex-direction: column;
    gap: $unit;
    padding: $unit * 1.5;
    border-radius: $card-corner;
    background: white;
    box-shadow: var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.06));
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: $unit * 1.5;
  }

  .portrait {
    position: relative;
    flex-shrink: 0;

    > img {
      display: block;
      width: $unit-6x;
      height: $unit-6x;
      border-radius: $item-corner-small;
    }
  }

  .perpetuity-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 18px;
    height: 18px;
  }

  // Centred against the portrait
  .identity {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: $unit-half;
    min-width: 0;
    min-height: $unit-6x;
  }

  .name {
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: $unit-half;
    flex-shrink: 0;

    // The shared checkbox is absolutely placed on grid items; sit it inline
    .item-checkbox {
      position: relative;
      top: auto;
      right: auto;
      bottom: auto;
      opacity: 1;
    }
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: $unit;

    // Rows and section titles line up with the card's own padding
    :global(.detail-row) {
      padding-left: 0;
      padding-right: 0;
    }

    :global(.details-section .header) {
      padding: 0;
    }
  }

  .rows {
    display: flex;
    flex-direction: column;
  }

  .perpetuity-check {
    display: inline-flex;
    color: var(--wind-nav-selected-text);
  }

  .card-missing {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $unit;
    padding: $unit;
    border-radius: $item-corner;
    background: var(--notice-grey-bg);

    p {
      margin: 0;
      font-size: $font-small;
      color: var(--color-text-tertiary);
    }
  }
</style>
