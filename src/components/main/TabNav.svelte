<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import SegmentedControl from '../shared/segmented-control/SegmentedControl.svelte'
  import Segment from '../shared/segmented-control/Segment.svelte'

  const showDatabase = $derived((app.auth?.role ?? 0) >= 7)

  const element = $derived(
    (app.auth?.avatar?.element as 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark') ?? null
  )

  function handleTabChange(value: string) {
    app.profilePopoverOpen = false
    app.activeTab = value as 'party' | 'collection' | 'database' | 'crew'
  }
</script>

<nav class="tabs">
  <SegmentedControl value={app.activeTab} onValueChange={handleTabChange} {element} variant="background" size="small" grow>
    <Segment value="party">{m.nav_party()}</Segment>
    <Segment value="collection">{m.nav_collection()}</Segment>
    <Segment value="crew">{m.nav_crew()}</Segment>
    {#if showDatabase}
      <Segment value="database">{m.nav_database()}</Segment>
    {/if}
  </SegmentedControl>
</nav>
