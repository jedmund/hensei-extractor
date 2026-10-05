<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import SlideView from '../shared/SlideView.svelte'
  import EmptyState from '../shared/EmptyState.svelte'
  import Icon from '../shared/Icon.svelte'
  import Tooltip from '../shared/Tooltip.svelte'
  import Button from '../shared/Button.svelte'
  import Input from '../shared/Input.svelte'
  import SegmentedControl from '../shared/segmented-control/SegmentedControl.svelte'
  import Segment from '../shared/segmented-control/Segment.svelte'
  import * as m from '../../paraglide/messages.js'
  import { fetchRaidGroups } from '../../lib/services/chrome-messages.js'
  import { BUCKET, RAID_SECTIONS, getImageUrl } from '../../lib/constants.js'
  import { getLocalizedName, translateError } from '../../lib/i18n.js'


  interface LocalizedName { en?: string; ja?: string }
  interface Raid {
    id: string
    name: string | LocalizedName
    name_en?: string
    name_jp?: string
    level?: number
    slug?: string
    group?: RaidGroup
  }
  interface RaidGroup {
    name: string | LocalizedName
    name_en?: string
    name_jp?: string
    section: number | string
    difficulty: number
    extra?: boolean
    raids?: Raid[]
  }

  let raidGroups = $state<RaidGroup[]>([])
  let selectedSection = $state<number>(RAID_SECTIONS.RAID)
  let searchQuery = $state('')
  let sortAscending = $state(false)
  let refreshing = $state(false)
  let loadError = $state('')

  const sections = [
    { id: RAID_SECTIONS.FARMING, label: () => m.raid_section_farming() },
    { id: RAID_SECTIONS.RAID, label: () => m.raid_section_raid() },
    { id: RAID_SECTIONS.EVENT, label: () => m.raid_section_event() },
    { id: RAID_SECTIONS.SOLO, label: () => m.raid_section_solo() },
  ]

  $effect(() => {
    if (app.raidPickerOpen) loadRaids()
  })

  // Clear the search however the picker closes (selection or Back).
  $effect(() => {
    if (!app.raidPickerOpen) searchQuery = ''
  })

  /** Loads the raid list. Returns an error code if the load failed. */
  async function loadRaids(force = false): Promise<string | null> {
    let error: string | null = null
    try {
      const res = await fetchRaidGroups(force)
      if (res.error) error = res.error
      else if (res.data) raidGroups = res.data as RaidGroup[]
    } catch {
      error = 'request_failed'
    }
    loadError = error ? translateError(error) : ''
    return error
  }

  async function refresh() {
    refreshing = true
    const error = await loadRaids(true)
    refreshing = false
    app.showToast(error ? translateError(error) : m.raid_reloaded())
  }

  function close() {
    app.raidPickerOpen = false
  }

  function getGroupName(group: RaidGroup): string {
    return getLocalizedName(group)
  }

  function getRaidName(raid: Raid): string {
    return getLocalizedName(raid)
  }

  function getRaidNameJp(raid: Raid): string {
    if (typeof raid.name === 'string') return ''
    return raid.name?.ja ?? raid.name_jp ?? ''
  }

  function getRaidImageUrl(raid: Raid): string {
    return raid.slug ? getImageUrl(`${BUCKET.raidThumbnail}/${raid.slug}.png`) : ''
  }

  let filteredGroups = $derived.by(() => {
    const query = searchQuery.toLowerCase().trim()
    let groups = raidGroups.filter((g) => {
      const sec = typeof g.section === 'string' ? parseInt(g.section) : g.section
      return sec === selectedSection
    })
    groups = [...groups].sort((a, b) => {
      const diff = a.difficulty - b.difficulty
      return sortAscending ? diff : -diff
    })
    if (query) {
      groups = groups
        .map((group) => {
          if (getGroupName(group).toLowerCase().includes(query)) return group
          const matching = (group.raids ?? []).filter((r) => {
            return getRaidName(r).toLowerCase().includes(query) || getRaidNameJp(r).toLowerCase().includes(query)
          })
          return matching.length > 0 ? { ...group, raids: matching } : null
        })
        .filter((g): g is RaidGroup => g !== null)
    }
    return groups
  })

  function selectRaid(raid: Raid, group: RaidGroup) {
    if (app.selectedRaid && app.selectedRaid.id === raid.id) {
      app.chooseRaid(null)
    } else {
      app.chooseRaid({ ...raid, group })
    }
    close()
  }
</script>

{#if app.raidPickerOpen}
<SlideView class="raid-picker-view" id="raidPickerView" title={m.raid_select()} onBack={close}>
  {#snippet right()}
    <Tooltip content={m.raid_reload_tooltip()}>
      <Button variant="ghost" size="small" iconOnly id="raidRefreshBtn" aria-label={m.raid_refresh()} disabled={refreshing} onclick={refresh}>
        <Icon name="refresh" size={14} />
      </Button>
    </Tooltip>
  {/snippet}

  <div class="raid-picker-search">
    <Input type="text" contained id="raidSearchInput" placeholder={m.raid_search()} bind:value={searchQuery} />
  </div>

  <div class="raid-picker-controls">
    <SegmentedControl value={String(selectedSection)} onValueChange={(v) => selectedSection = Number(v)} variant="background" size="small" grow>
      {#each sections as sec}
        <Segment value={String(sec.id)}>{sec.label()}</Segment>
      {/each}
    </SegmentedControl>
    <Tooltip content={sortAscending ? m.raid_sort_lowest() : m.raid_sort_highest()}>
      <Button variant="ghost" size="small" iconOnly aria-label={sortAscending ? m.raid_sort_lowest() : m.raid_sort_highest()} onclick={() => sortAscending = !sortAscending}>
        {#if sortAscending}
          <Icon name="arrow-sort-up" size={14} />
        {:else}
          <Icon name="arrow-sort-down" size={14} />
        {/if}
      </Button>
    </Tooltip>
  </div>

  <div class="raid-picker-content" id="raidPickerContent">
    {#if raidGroups.length === 0 && loadError}
      <EmptyState variant="list" message={loadError} />
    {:else if filteredGroups.length === 0}
      <EmptyState variant="list" message={m.raid_no_results()} />
    {:else}
      {#each filteredGroups as group}
        {#if (group.raids ?? []).length > 0}
          <div class="raid-group">
            <div class="raid-group-header">
              <span class="raid-group-name">{getGroupName(group)}</span>
              {#if group.extra}<span class="raid-ex-badge">EX</span>{/if}
            </div>
            <div class="raid-group-raids">
              {#each group.raids ?? [] as raid}
                {@const isSelected = app.selectedRaid !== null && app.selectedRaid.id === raid.id}
                <button type="button" class="raid-item" class:selected={isSelected} onclick={() => selectRaid(raid, group)}>
                  {#if getRaidImageUrl(raid)}
                    <img src={getRaidImageUrl(raid)} alt="" class="raid-item-icon" onerror={(e: Event) => { (e.target as HTMLElement).style.display = 'none' }} />
                  {/if}
                  <div class="raid-item-info">
                    <span class="raid-item-name">{getRaidName(raid)}</span>
                    {#if raid.level}<span class="raid-item-level">Lv. {raid.level}</span>{/if}
                  </div>
                  {#if isSelected}
                    <Icon name="check" size={14} class="raid-item-check" />
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</SlideView>
{/if}
