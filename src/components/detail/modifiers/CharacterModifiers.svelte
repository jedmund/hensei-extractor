<script lang="ts">
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import * as m from '../../../paraglide/messages.js'
  import Tooltip from '../../shared/Tooltip.svelte'

  /**
   * Badges over a character's art: the perpetuity ring and, in parties, the
   * awakening type. See "Character Modifiers" in _detail.scss.
   */
  interface Props {
    perpetuity: boolean
    /** Awakening icon slug; leave it out where the awakening isn't shown */
    awakening?: string | null
  }

  let { perpetuity, awakening = null }: Props = $props()
</script>

{#if awakening || perpetuity}
  <div class="char-modifiers">
    {#if perpetuity}
      <Tooltip content={m.stat_perpetuity_ring()}><img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt={m.stat_perpetuity_ring()}></Tooltip>
    {/if}
    {#if awakening}
      <Tooltip content={m.stat_awakening()}><img class="awakening-icon" src={getImageUrl(`${BUCKET.awakening}/${awakening}.jpg`)} alt={m.stat_awakening()}></Tooltip>
    {/if}
  </div>
{/if}
