<!-- What a run imports without one of its captures, as a yellow notice
     with a button to the game page that captures it. -->

<script lang="ts">
  import { openGamePage } from '../../../lib/game-tab.js'
  import Button from '../../shared/Button.svelte'
  import Notice from '../../shared/Notice.svelte'

  interface Props {
    /** Paragraphs are separated by blank lines */
    message: string
    /** The game page that captures it, when known */
    page: string | null
    /** The button's label: "Go to …" */
    actionLabel: string
  }

  let { message, page, actionLabel }: Props = $props()
</script>

<Notice variant="yellow">
  <p class="message">{message}</p>
  {#if page}
    <div>
      <Button variant="raised" size="small" onclick={() => void openGamePage(page)}>
        {actionLabel}
      </Button>
    </div>
  {/if}
</Notice>

<style lang="scss">
  .message {
    white-space: pre-line;
  }
</style>
