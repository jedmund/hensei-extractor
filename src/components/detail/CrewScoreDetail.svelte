<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import {
    createCrew,
    previewGwPhantoms
  } from '../../lib/services/chrome-messages.js'
  import Select from '../shared/Select.svelte'
  import Icon from '../shared/Icon.svelte'
  import Button from '../shared/Button.svelte'

  interface UnfMember {
    id: string
    name: string
    contribution: number
    rank: number
    level: string
  }

  interface Props {
    data: {
      eventNumber: number
      members: UnfMember[]
      totalPages: number
      pageCount: number
      isComplete: boolean
    }
  }

  let { data }: Props = $props()

  let hasCrew = $derived(!!app.auth?.hasCrew)
  let isDailyScores = $derived(
    app.currentDetailDataType?.startsWith('unf_daily_scores_') ?? false
  )
  let crewName = $state('')
  let creating = $state(false)
  let createError = $state('')

  let existingPhantomIds = $state<Set<string>>(new Set())
  let newPhantomIds = $state<Set<string>>(new Set())
  let phantomChecked = $state(false)

  $effect(() => {
    if (hasCrew && data.members.length > 0 && !phantomChecked) {
      phantomChecked = true
      const dataType = app.currentDetailDataType
      if (dataType) {
        previewGwPhantoms(dataType).then((result) => {
          if (result.existingPhantomIds) {
            existingPhantomIds = new Set(result.existingPhantomIds)
          }
          if (result.newPhantomIds) {
            newPhantomIds = new Set(result.newPhantomIds)
          }
        })
      }
    }
  })

  const roundOptions = [
    { value: 'preliminaries', label: m.crew_round_preliminaries() },
    { value: 'interlude', label: m.crew_round_interlude() },
    { value: 'finals_day_1', label: m.crew_round_finals_1() },
    { value: 'finals_day_2', label: m.crew_round_finals_2() },
    { value: 'finals_day_3', label: m.crew_round_finals_3() },
    { value: 'finals_day_4', label: m.crew_round_finals_4() }
  ]

  function formatHonors(n: number): string {
    return n.toLocaleString()
  }

  function openProfile(id: string) {
    chrome.tabs.create({
      url: `https://game.granbluefantasy.jp/#profile/${id}`
    })
  }

  async function handleCreateCrew() {
    if (!crewName.trim()) return
    creating = true
    createError = ''

    try {
      const result = await createCrew(crewName.trim())
      if (result.error === 'crew_already_exists') {
        createError = m.crew_create_error_exists()
      } else if (result.error) {
        createError = result.error
      } else {
        app.auth = { ...app.auth!, hasCrew: true }
        app.showToast(m.crew_create_success())
      }
    } catch {
      createError = m.error_request_failed()
    } finally {
      creating = false
    }
  }
</script>

<div class="crew-score-detail">
  {#if !hasCrew}
    <div class="crew-create-form">
      <p class="crew-create-desc">{m.crew_create_desc()}</p>
      <label class="crew-create-label" for="crewNameInput">
        {m.crew_create_name_label()}
      </label>
      <input
        id="crewNameInput"
        class="crew-create-input"
        type="text"
        placeholder={m.crew_create_name_placeholder()}
        bind:value={crewName}
        onkeydown={(e) => { if (e.key === 'Enter') handleCreateCrew() }}
      />
      {#if createError}
        <p class="crew-create-error">{createError}</p>
      {/if}
      <Button
        size="small"
        disabled={creating || !crewName.trim()}
        onclick={handleCreateCrew}
      >
        {creating ? m.action_creating() : m.crew_create_title()}
      </Button>
    </div>
  {/if}

  {#if hasCrew && isDailyScores}
    <div class="crew-round-select">
      <Select
        options={roundOptions}
        bind:value={app.crewImportRound}
        fullWidth
        size="small"
      />
    </div>
  {/if}

  <div class="crew-member-list">
    {#each data.members as member (member.id)}
      <button
        class="crew-member-row"
        onclick={() => openProfile(member.id)}
      >
        <span class="crew-member-rank">#{member.rank}</span>
        <div class="crew-member-info">
          <span class="crew-member-name-row">
            <span class="crew-member-name">{member.name}</span>
            {#if newPhantomIds.has(member.id)}
              <span class="crew-member-tag new">{m.crew_tag_new()}</span>
            {:else if existingPhantomIds.has(member.id)}
              <span class="crew-member-tag phantom">{m.crew_tag_phantom()}</span>
            {/if}
          </span>
          <span class="crew-member-id">{member.id}</span>
        </div>
        <span class="crew-member-honors">{formatHonors(member.contribution)}</span>
        <Icon name="chevron-right" size={14} class="crew-member-chevron" />
      </button>
    {/each}
  </div>
</div>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;
  @use 'themes/effects' as *;

  .crew-score-detail {
    display: flex;
    flex-direction: column;
  }

  .crew-create-form {
    padding: $unit-2x;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: $unit;
  }

  .crew-create-desc {
    font-size: $font-tiny;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .crew-create-label {
    font-size: $font-micro;
    font-weight: $semibold;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .crew-create-input {
    padding: $unit-three-quarter $unit;
    border: 1px solid var(--color-border);
    border-radius: $input-corner;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    font-size: $font-small;
    outline: none;

    &:focus {
      border-color: var(--color-accent);
    }
  }

  .crew-create-error {
    font-size: $font-tiny;
    color: var(--color-error);
    margin: 0;
  }

  .crew-round-select {
    padding: $unit-2x $unit-2x $unit;
  }

  .crew-member-list {
    display: flex;
    flex-direction: column;
    padding: $unit-half;
  }

  .crew-member-row {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: $unit;
    padding: $unit $unit-2x $unit $unit;
    border-radius: $item-corner;
    cursor: pointer;
    @include smooth-transition($duration-quick, background-color);

    &:hover {
      background-color: var(--color-bg-primary, #fff);
    }
  }

  .crew-member-rank {
    font-size: $font-tiny;
    color: var(--color-text-tertiary);
    min-width: $unit-3x;
    font-variant-numeric: tabular-nums;
  }

  .crew-member-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: 1px;
  }

  .crew-member-name-row {
    display: flex;
    align-items: center;
    gap: $unit-half;
    min-width: 0;
  }

  .crew-member-name {
    font-size: $font-small;
    font-weight: $medium;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crew-member-tag {
    display: inline-flex;
    align-items: center;
    padding: 1px $unit-half;
    border-radius: $item-corner-small;
    font-size: $font-micro;
    font-weight: $medium;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.4;
    flex-shrink: 0;

    &.phantom {
      background: var(--color-bg-tertiary, rgba(0, 0, 0, 0.06));
      color: var(--color-text-tertiary);
    }

    &.new {
      background: var(--color-warning, #fffcd2);
      color: var(--color-warning-text, #7a6200);
    }
  }

  .crew-member-id {
    font-size: $font-tiny;
    color: var(--color-text-tertiary);
  }

  .crew-member-honors {
    font-size: $font-small;
    font-weight: $normal;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  :global(.crew-member-chevron) {
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }
</style>
