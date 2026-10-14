<!-- What a run imports without the Evoker's party deck, as a yellow notice
     with a button to the party page that captures it. -->

<script lang="ts">
  import * as m from '../../../paraglide/messages.js'
  import { openGamePage } from '../../../lib/game-tab.js'
  import Button from '../../shared/Button.svelte'
  import Notice from '../../shared/Notice.svelte'

  interface Props {
    /** Paragraphs are separated by blank lines */
    message: string
    /** The game page that captures the deck, when the Evoker is known */
    page: string | null
  }

  let { message, page }: Props = $props()
</script>

<Notice variant="yellow">
  <p class="message">{message}</p>
  {#if page}
    <div>
      <Button variant="raised" size="small" onclick={() => void openGamePage(page)}>
        {m.solomonis_extension_go_to_party()}
      </Button>
    </div>
  {/if}
</Notice>

<style lang="scss">
  .message {
    white-space: pre-line;
  }
</style>
