<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { createCrew } from '../../lib/services/chrome-messages.js'

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
  let crewName = $state('')
  let creating = $state(false)
  let createError = $state('')

  function formatHonors(n: number): string {
    return n.toLocaleString()
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
      <button
        class="crew-create-button"
        disabled={creating || !crewName.trim()}
        onclick={handleCreateCrew}
      >
        {creating ? m.action_creating() : m.crew_create_title()}
      </button>
    </div>
  {/if}

  {#if !data.isComplete}
    <div class="crew-incomplete-warning">
      {m.crew_pages_incomplete()}
    </div>
  {/if}

  <div class="crew-member-list">
    {#each data.members as member (member.id)}
      <div class="crew-member-row">
        <span class="crew-member-rank">#{member.rank}</span>
        <div class="crew-member-info">
          <span class="crew-member-name">{member.name}</span>
          <span class="crew-member-id">{member.id}</span>
        </div>
        <span class="crew-member-honors">{formatHonors(member.contribution)}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .crew-score-detail {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .crew-create-form {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .crew-create-desc {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .crew-create-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .crew-create-input {
    padding: 6px 8px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    font-size: 13px;
    outline: none;
  }

  .crew-create-input:focus {
    border-color: var(--color-accent);
  }

  .crew-create-error {
    font-size: 12px;
    color: var(--color-error);
    margin: 0;
  }

  .crew-create-button {
    align-self: flex-start;
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: var(--color-accent);
    color: white;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .crew-create-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .crew-incomplete-warning {
    padding: 8px 16px;
    font-size: 12px;
    color: var(--color-warning, #b58a00);
    background: var(--color-warning-bg, rgba(181, 138, 0, 0.08));
    border-bottom: 1px solid var(--color-border);
  }

  .crew-member-list {
    display: flex;
    flex-direction: column;
  }

  .crew-member-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .crew-member-rank {
    font-size: 12px;
    color: var(--color-text-secondary);
    min-width: 28px;
    font-variant-numeric: tabular-nums;
  }

  .crew-member-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .crew-member-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crew-member-id {
    font-size: 11px;
    color: var(--color-text-tertiary);
  }

  .crew-member-honors {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
