<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { openGamePage } from '../../lib/game-tab.js'
  import type {
    SolomonisStep,
    SolomonisStepKey,
    SolomonisStepNeed
  } from '../../lib/solomonis/steps.js'
  import Button from '../shared/Button.svelte'

  interface Props {
    steps: SolomonisStep[]
  }

  let { steps }: Props = $props()

  const labels: Record<SolomonisStepKey, () => string> = {
    report: m.solomonis_extension_log_report,
    book: m.solomonis_extension_log_book,
    deck: m.solomonis_extension_log_deck
  }

  const hints: Record<SolomonisStepKey, () => string> = {
    report: m.solomonis_extension_open_report_hint,
    book: m.solomonis_extension_open_book_hint,
    deck: m.solomonis_extension_open_deck_hint
  }

  const needs: Record<SolomonisStepNeed, () => string> = {
    required: m.solomonis_extension_need_required,
    recommended: m.solomonis_extension_need_recommended,
    optional: m.solomonis_extension_need_optional
  }
</script>

<ol class="steps" aria-live="polite">
  {#each steps as step (step.key)}
    <li class="step" class:captured={step.captured}>
      <div class="step-row">
        <span class="step-mark" aria-hidden="true">{step.captured ? '✓' : ''}</span>
        <span class="step-label">{labels[step.key]()}</span>
        {#if !step.captured}
          <span class="step-need">{needs[step.need]()}</span>
        {/if}
        <span class="step-state">
          {step.captured
            ? m.solomonis_extension_log_captured()
            : m.solomonis_extension_log_missing()}
        </span>
      </div>
      {#if !step.captured}
        <div class="step-body">
          <p class="step-hint">{hints[step.key]()}</p>
          {#if step.page}
            {@const page = step.page}
            <Button size="small" onclick={() => void openGamePage(page)}>
              {m.solomonis_extension_open_in_game()}
            </Button>
          {/if}
        </div>
      {/if}
    </li>
  {/each}
</ol>

<style lang="scss">
  @use 'themes/layout' as *;
  @use 'themes/typography' as *;
  @use 'themes/spacing' as *;

  .steps {
    display: flex;
    flex-direction: column;
    gap: $unit;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: $unit;
    font-size: $font-small;
  }

  .step-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: $unit-2x;
    height: $unit-2x;
    border: 1px solid var(--color-text-secondary);
    border-radius: 50%;
    font-size: $font-tiny;
    color: var(--color-text);
  }

  .step.captured .step-mark {
    border-color: var(--color-text);
  }

  .step-label {
    color: var(--color-text);
  }

  .step-need {
    color: var(--color-text-secondary);
    font-size: $font-tiny;
  }

  .step-state {
    margin-left: auto;
    color: var(--color-text-secondary);
  }

  .step.captured .step-state {
    color: var(--color-text);
  }

  .step-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: $unit-half;
    padding-left: calc(#{$unit-2x} + #{$unit});
  }

  .step-hint {
    margin: 0;
    font-size: $font-small;
    color: var(--color-text-secondary);
  }
</style>
