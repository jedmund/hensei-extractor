<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '../../lib/state/app.svelte.js'
  import * as m from '../../paraglide/messages.js'
  import { fetchRaidGroups } from '../../lib/services/chrome-messages.js'
  import { RAID_SECTIONS, getImageUrl } from '../../lib/constants.js'
  import { getLocale } from '../../lib/i18n.js'

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

  async function loadRaids(force = false) {
    const res = await fetchRaidGroups(force)
    if (!res.error && res.data) raidGroups = res.data as RaidGroup[]
  }

  async function refresh() {
    refreshing = true
    await loadRaids(true)
    refreshing = false
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
<div class="picker-view raid-picker-view active">
  <header class="picker-header">
    <button type="button" class="picker-back" onclick={close}>{m.action_back()}</button>
    <h2 class="picker-title">{m.raid_select()}</h2>
    <button type="button" class="picker-action" class:loading={refreshing} onclick={refresh}>{m.raid_refresh()}</button>
  </header>

  <div class="picker-search">
    <input type="text" class="raid-search-input" placeholder={m.raid_search()} bind:value={searchQuery} />
  </div>

  <div class="raid-section-tabs">
    {#each sections as sec}
      <button
        type="button"
        class="raid-section-tab"
        class:active={selectedSection === sec.id}
        onclick={() => selectedSection = sec.id}
      >{sec.label()}</button>
    {/each}
  </div>

  <div class="raid-sort">
    <button type="button" class="raid-sort-btn" onclick={() => sortAscending = !sortAscending}>
      {#if sortAscending}
        <svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M2.04805 6.94536C1.65772 6.55487 1.65772 5.92178 2.04805 5.5313L6.29122 1.28911C6.46389 1.11655 6.68384 1.01998 6.90938 1.00005C7.19607 0.972746 7.49257 1.06957 7.71212 1.28911L11.9553 5.5313C12.3451 5.92172 12.3452 6.55497 11.9553 6.94536C11.5649 7.33563 10.9318 7.33534 10.5412 6.94536L8.00508 4.4102L8.00508 11.9981C8.00508 12.5502 7.55711 12.9978 7.00508 12.9981C6.4528 12.9981 6.00508 12.5504 6.00508 11.9981L6.00508 4.40337L3.46212 6.94536C3.07171 7.33561 2.43856 7.33544 2.04805 6.94536Z"/></svg>
      {:else}
        <svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M11.9546 7.04822C12.3449 7.43871 12.3449 8.07179 11.9546 8.46228L7.7114 12.7045C7.53873 12.877 7.31878 12.9736 7.09323 12.9935C6.80654 13.0208 6.51004 12.924 6.2905 12.7045L2.04734 8.46228C1.65747 8.07186 1.65742 7.43861 2.04734 7.04822C2.4377 6.65794 3.07086 6.65823 3.4614 7.04822L5.99753 9.58337L5.99753 1.99548C5.99753 1.44339 6.44551 0.995793 6.99753 0.995483C7.54982 0.995483 7.99753 1.4432 7.99753 1.99548L7.99753 9.59021L10.5405 7.04822C10.9309 6.65797 11.5641 6.65814 11.9546 7.04822Z"/></svg>
      {/if}
    </button>
  </div>

  <div class="picker-content raid-picker-content">
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
                    <svg class="raid-item-check" viewBox="0 0 14 14" fill="currentColor" width="14" height="14"><path d="M11.53 3.47a.75.75 0 0 1 .073.976l-.073.084-5.5 5.5a.75.75 0 0 1-.976.073l-.084-.073-2.5-2.5a.75.75 0 0 1 .976-1.133l.084.073L5.5 8.44l4.97-4.97a.75.75 0 0 1 1.06 0z"/></svg>
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
