<!-- A tab whose capture is still missing: a button that opens the game page
     that captures it, centred in the tab. Without a known page there's only
     the message. -->

<script lang="ts">
  import { openGamePage } from '../../../lib/game-tab.js'
  import Button from '../../shared/Button.svelte'
  import EmptyState from '../../shared/EmptyState.svelte'

  interface Props {
    /** What capturing it means, shown above the button */
    message: string
    /** The game page (`#…`) to open, or null when it isn't known */
    page: string | null
    /** The button's label: "Go to …" */
    actionLabel: string
  }

  let { message, page, actionLabel }: Props = $props()
</script>

<EmptyState class="run-empty" {message}>
  {#snippet actions()}
    {#if page}
      <Button variant="primary" size="small" onclick={() => void openGamePage(page)}>
        {actionLabel}
      </Button>
    {/if}
  {/snippet}
</EmptyState>
