<script lang="ts">
  import { artifactLabelIcons } from '../../../lib/item-stats.js'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'

  /** An artifact's element and proficiency label icons in a list row */
  interface Props {
    item: RawGameItem
  }

  let { item }: Props = $props()
</script>

<div class="list-item-labels">{#each artifactLabelIcons(item) as src}<img class="label-icon" {src} alt="">{/each}</div>
