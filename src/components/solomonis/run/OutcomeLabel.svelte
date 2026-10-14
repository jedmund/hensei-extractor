<!-- An expedition's outcome, as in hensei-web's OutcomeLabel: Cleared in
     green, Failed muted. The report only says whether the run succeeded. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'

  interface Props {
    success: boolean
  }

  let { success }: Props = $props()
</script>

<span class="outcome" class:cleared={success}>
  {success ? m.solomonis_extension_outcome_cleared() : m.solomonis_extension_outcome_failed()}
</span>

<style lang="scss">
  @use 'themes/typography' as *;

  .outcome {
    font-weight: $medium;
    color: var(--color-text-tertiary);

    &.cleared {
      color: var(--wind-nav-selected-text);
    }
  }
</style>
