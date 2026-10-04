<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { app } from '../../../lib/state/app.svelte.js'
  import { decodeHtmlEntities } from '../../../lib/html-entities.js'
  import {
    partyLookups,
    countPartyMembers,
    applySuggestedRaid,
    type PartyDeckData
  } from '../../../lib/detail-data.js'
  import { fetchRaidGroups, searchSummonByName, fetchWeaponKeyMap, fetchWeaponStatModifiers, fetchJobSkillSlugs } from '../../../lib/services/chrome-messages.js'
  import { getLocale } from '../../../lib/i18n.js'
  import type { SummonSearchResult, WeaponKeyMap, WeaponStatModifiers, JobSkillSlugs } from '../../../lib/types/messages.js'

  import DetailScroll from '../DetailScroll.svelte'
  import PartyDetail from './PartyDetail.svelte'
  import PartyMeta from './PartyMeta.svelte'

  interface Props {
    dataType: string
    /** The cached capture, or null until it has loaded */
    data: unknown
    /** Changes whenever DetailView loads a new capture for this view */
    generation: number
    simplePortraits: boolean
    scrolled?: boolean
  }

  let { dataType, data, generation, simplePortraits, scrolled = $bindable(false) }: Props = $props()

  // Looked up by name and id, to label the captured deck
  let friendSummon = $state<SummonSearchResult | null>(null)
  let friendSummonPending = $state(false)
  let weaponKeyMap = $state<WeaponKeyMap | null>(null)
  let jobSkillSlugs = $state<JobSkillSlugs>({})
  let weaponStatModifiers = $state<WeaponStatModifiers | null>(null)

  let destroyed = false
  onDestroy(() => {
    destroyed = true
  })

  // Load for each capture DetailView hands over: on open, and again when
  // the party is captured again.
  $effect(() => {
    const gen = generation
    if (!gen) return
    untrack(() => load(gen, data as PartyDeckData))
  })

  async function load(gen: number, party: PartyDeckData) {
    // Drops results once a newer capture has arrived or the view has gone.
    // The view stays mounted while it slides out after Back, so the app
    // state writes also check it's still the open view.
    const current = () =>
      !destroyed && gen === generation && app.currentDetailDataType === dataType
    // A raid picked by hand while the lookups run wins over the suggestion
    const manualSelectionsAtStart = app.manualRaidSelections

    // The game escapes HTML in team names (`A &gt; B`).
    app.partyName = decodeHtmlEntities(party?.deck?.name || '')

    await loadSupplementary(party, current)
    if (!current()) return

    const { weapons, characters } = countPartyMembers(party)
    await applySuggestedRaid({
      target: app,
      manualSelectionsAtStart,
      weapons,
      characters,
      loadRaidGroups: fetchRaidGroups,
      current
    })
  }

  async function loadSupplementary(party: PartyDeckData, current: () => boolean) {
    const { summonName, skillNames } = partyLookups(party)

    friendSummon = null
    friendSummonPending = !!summonName
    const [summonResult, keyMap, skillSlugs, statMods] = await Promise.all([
      summonName ? searchSummonByName(summonName) : Promise.resolve(null),
      fetchWeaponKeyMap(getLocale()),
      skillNames.length > 0 ? fetchJobSkillSlugs(skillNames) : Promise.resolve({}),
      fetchWeaponStatModifiers()
    ])
    if (!current()) return

    friendSummon = summonResult
    friendSummonPending = false
    weaponKeyMap = keyMap
    jobSkillSlugs = skillSlugs
    weaponStatModifiers = statMods
  }
</script>

<PartyMeta {scrolled} />

<DetailScroll bind:scrolled>
  {#if data}
    <PartyDetail
      data={data as Record<string, unknown>}
      {friendSummon}
      {friendSummonPending}
      {weaponKeyMap}
      {jobSkillSlugs}
      {weaponStatModifiers}
      {simplePortraits}
    />
  {/if}
</DetailScroll>
