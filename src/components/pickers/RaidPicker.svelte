<script lang="ts">
  import type { Snippet } from 'svelte'
  import { onMount } from 'svelte'
  import { app } from '../../lib/state/app.svelte.js'
  import { slideRight } from '../../lib/transitions.js'
  import NavigationBar from '../shared/NavigationBar.svelte'
  import Icon from '../shared/Icon.svelte'
  import Tooltip from '../shared/Tooltip.svelte'
  import Button from '../shared/Button.svelte'
  import Input from '../shared/Input.svelte'
  import SegmentedControl from '../shared/segmented-control/SegmentedControl.svelte'
  import Segment from '../shared/segmented-control/Segment.svelte'
  import * as m from '../../paraglide/messages.js'
  import { fetchRaidGroups } from '../../lib/services/chrome-messages.js'
  import { RAID_SECTIONS, getImageUrl } from '../../lib/constants.js'
  import { getLocale } from '../../lib/i18n.js'

  interface Props {
    onBack?: () => void
    navRight?: Snippet
  }

  let { onBack, navRight }: Props = $props()

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

  const sections = [
    { id: RAID_SECTIONS.FARMING, label: () => m.raid_section_farming() },
    { id: RAID_SECTIONS.RAID, label: () => m.raid_section_raid() },
    { id: RAID_SECTIONS.EVENT, label: () => m.raid_section_event() },
    { id: RAID_SECTIONS.SOLO, label: () => m.raid_section_solo() },
  ]

  $effect(() => {
    if (app.raidPickerOpen) loadRaids()
  })

  $effect(() => {
    if (app.raidRefresh) {
      app.raidRefresh = false
      refresh()
    }
  })

  async function loadRaids(force = false) {
    const res = await fetchRaidGroups(force)
    if (!res.error && res.data) raidGroups = res.data as RaidGroup[]
  }

  async function refresh() {
    refreshing = true
    await loadRaids(true)
    refreshing = false
    app.showToast(m.raid_reloaded())
  }

  function close() {
    app.raidPickerOpen = false
    searchQuery = ''
  }

  function getGroupName(group: RaidGroup): string {
    if (typeof group.name === 'string') return group.name
    const loc = getLocale()
    if (loc === 'ja') return group.name?.ja ?? group.name_jp ?? group.name?.en ?? group.name_en ?? 'Unknown'
    return group.name?.en ?? group.name_en ?? group.name?.ja ?? group.name_jp ?? 'Unknown'
  }

  function getRaidName(raid: Raid): string {
    if (typeof raid.name === 'string') return raid.name
    const loc = getLocale()
    if (loc === 'ja') return raid.name?.ja ?? raid.name_jp ?? raid.name?.en ?? raid.name_en ?? 'Unknown'
    return raid.name?.en ?? raid.name_en ?? raid.name?.ja ?? raid.name_jp ?? 'Unknown'
  }

  function getRaidNameJp(raid: Raid): string {
    if (typeof raid.name === 'string') return ''
    return raid.name?.ja ?? raid.name_jp ?? ''
  }

  function getRaidImageUrl(raid: Raid): string {
    return raid.slug ? getImageUrl(`raid-thumbnail/${raid.slug}.png`) : ''
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
      app.selectedRaid = null
    } else {
      app.selectedRaid = { ...raid, group }
    }
    close()
  }
</script>

{#if app.raidPickerOpen}
<div class="raid-picker-view" id="raidPickerView" transition:slideRight>
  <NavigationBar title={m.raid_select()}>
    {#snippet left()}
      <button class="detail-back" onclick={onBack}>
        <Icon name="chevron-left" size={14} />
        <span>{m.action_back()}</span>
      </button>
    {/snippet}
    {#snippet right()}
      {#if navRight}{@render navRight()}{/if}
    {/snippet}
  </NavigationBar>

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
      <Button variant="ghost" size="small" iconOnly onclick={() => sortAscending = !sortAscending}>
        {#if sortAscending}
          <Icon name="arrow-sort-up" size={14} />
        {:else}
          <Icon name="arrow-sort-down" size={14} />
        {/if}
      </Button>
    </Tooltip>
  </div>

  <div class="raid-picker-content" id="raidPickerContent">
    {#if filteredGroups.length === 0}
      <div class="raid-empty-state">{m.raid_no_results()}</div>
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
</div>
{/if}
