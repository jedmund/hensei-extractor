<script lang="ts">
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import {
    toArray,
    getWeaponModifiers,
    maxEvolutionArtSuffixes,
    type WeaponStatModifier
  } from '../../../lib/detail-helpers.js'
  import { getCharacterArtFallbacks, toHenseiElement } from '../../../lib/images.js'
  import {
    CHARACTER_AWAKENING_MAPPING,
    NULL_ELEMENT_CHARACTER_IDS,
    resolveForgedSummonId
  } from '../../../lib/game-data.js'
  import * as m from '../../../paraglide/messages.js'
  import Tooltip from '../../shared/Tooltip.svelte'
  import CharacterModifiers from '../modifiers/CharacterModifiers.svelte'
  import WeaponModifiers from '../modifiers/WeaponModifiers.svelte'

  interface RawPartyItem {
    id?: string
    master?: { id?: string; name?: string; image?: string; [key: string]: unknown }
    param?: {
      id?: string
      evolution?: number
      phase?: number
      style?: string
      image_id?: string
      has_npcaugment_constant?: boolean
      npc_arousal_form?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }

  interface SummonSearchResult {
    granblue_id?: string
    name?: { en?: string; ja?: string }
    uncap?: { flb?: boolean; ulb?: boolean; transcendence?: boolean }
  }

  interface BulletEntry {
    bullet_id?: string
    name?: string
    [key: string]: unknown
  }

  interface PartyData {
    deck?: {
      pc?: {
        job?: { master?: { id?: string; name?: string; image?: string } }
        weapons?: Record<string, RawPartyItem | null>
        summons?: Record<string, RawPartyItem | null>
        sub_summons?: Record<string, RawPartyItem | null>
        damage_info?: { summon_name?: string }
        set_action?: Array<{ name: string }>
        familiar_id?: string
        shield_id?: string
        quick_user_summon_id?: string
        [key: string]: unknown
      }
      npc?: Record<string, RawPartyItem | null>
      name?: string
      [key: string]: unknown
    }
    bullet_info?: { set_bullets?: Record<string, BulletEntry> }
    [key: string]: unknown
  }

  interface Props {
    data: Record<string, unknown>
    friendSummon?: SummonSearchResult | null
    /** True while the support summon is being looked up by name */
    friendSummonPending?: boolean
    weaponKeyMap?: Record<string, { slug: string; name: string }> | null
    jobSkillSlugs?: Record<string, string | null>
    weaponStatModifiers?: Record<string, WeaponStatModifier> | null
    simplePortraits?: boolean
  }

  let {
    data: rawData,
    friendSummon = null,
    friendSummonPending = false,
    weaponKeyMap = null,
    jobSkillSlugs = {},
    weaponStatModifiers = null,
    simplePortraits = false
  }: Props = $props()

  let data = $derived(rawData as PartyData)
  let deck = $derived(data?.deck)
  let pc = $derived(deck?.pc)
  let job = $derived(pc?.job)
  let characters = $derived(toArray(deck?.npc).filter(Boolean) as RawPartyItem[])
  let weapons = $derived(toArray(pc?.weapons).filter(Boolean) as RawPartyItem[])
  let summons = $derived(toArray(pc?.summons).filter(Boolean) as RawPartyItem[])
  let subSummons = $derived(toArray(pc?.sub_summons).filter(Boolean) as RawPartyItem[])
  let accessoryIds = $derived([pc?.familiar_id, pc?.shield_id].filter(Boolean) as string[])
  let quickSummonId = $derived(pc?.quick_user_summon_id)
  // The party only names its support summon; it's matched by name, which can fail.
  let friendSummonName = $derived(pc?.damage_info?.summon_name)

  // Support summon art at max evolution, stepping down when a summon doesn't
  // have a given alt art (see maxEvolutionArtSuffixes).
  let friendArtSuffixes = $derived(maxEvolutionArtSuffixes(friendSummon?.uncap))
  let friendArtStep = $state(0)
  $effect(() => {
    void friendSummon
    friendArtStep = 0
  })
  let friendArtUrl = $derived(
    friendSummon
      ? getImageUrl(`${BUCKET.summonTall}/${friendSummon.granblue_id}${friendArtSuffixes[friendArtStep] ?? ''}.jpg`)
      : ''
  )
  function nextFriendArt() {
    if (friendArtStep < friendArtSuffixes.length - 1) friendArtStep += 1
  }
  let setAction = $derived(pc?.set_action || [])

  let mainWeapon = $derived(weapons[0])
  let gridWeapons = $derived(weapons.slice(1))
  // Fixed summon slots (4 grid, then 2 sub when unlocked) so an empty slot
  // shows a placeholder instead of the rest shifting up. A slot is empty when
  // it's missing, null, or has no summon.
  function summonSlot(data: unknown, key: number): RawPartyItem | null {
    const item = (data as Record<string, RawPartyItem | null> | undefined)?.[String(key)]
    return item && (item.master?.id || item.param?.id) ? item : null
  }
  let mainSummon = $derived(summonSlot(pc?.summons, 1))
  let gridSummonSlots = $derived([2, 3, 4, 5].map((key) => summonSlot(pc?.summons, key)))
  let subSummonSlots = $derived(
    pc?.is_open_sub_summon === false ? [] : [1, 2].map((key) => summonSlot(pc?.sub_summons, key))
  )
  let allSubSummonSlots = $derived([...gridSummonSlots, ...subSummonSlots])

  let bulletInfo = $derived(data?.bullet_info?.set_bullets)
  let bullets = $derived.by((): BulletEntry[] => {
    if (!bulletInfo) return []
    return Object.entries(bulletInfo)
      .filter(([key]) => key.startsWith('bullet_'))
      .map(([, bullet]) => bullet)
      .filter((b): b is BulletEntry => !!b && !!b.bullet_id)
  })

  // Null-element characters (Lyria, Young Cat) follow the party's element,
  // which the main weapon sets, and have art for each element.
  let partyElement = $derived(
    toHenseiElement(mainWeapon?.master?.attribute as string | number | undefined)
  )

  // When character art is missing, try the element art and then the base art
  // in turn (see getCharacterArtFallbacks). The queue is restarted whenever
  // the image now shows something other than the fallback we last set, such as
  // a different party's character in the same slot.
  function nextCharacterArt(e: Event) {
    const img = e.currentTarget as HTMLImageElement
    const queue: string[] =
      img.dataset.fallbackLast === img.src && img.dataset.fallbacks
        ? JSON.parse(img.dataset.fallbacks)
        : getCharacterArtFallbacks(img.src, partyElement)
    const next = queue.shift()
    if (!next) return
    img.dataset.fallbacks = JSON.stringify(queue)
    img.dataset.fallbackLast = next
    img.src = next
  }

  function getCharImageSuffix(item: RawPartyItem): string {
    if (item.param?.style === '2') return '_01_style'
    const evolution = item.param?.evolution
    const phase = item.param?.phase
    let pose = '_01'
    if (phase && phase > 0) pose = '_04'
    else if (evolution && evolution >= 5) pose = '_03'
    else if (evolution && evolution > 2) pose = simplePortraits ? '_01' : '_02'

    // Null-element characters show the art for the party's element. If that
    // pose has no element art, nextCharacterArt steps down from here.
    const id = String(item.master?.id || item.param?.id || item.id || '')
    if (partyElement && NULL_ELEMENT_CHARACTER_IDS.has(id)) {
      return `${pose}_0${partyElement}`
    }
    return pose
  }

  function getImageSuffix(item: RawPartyItem): string {
    const imageId = item.param?.image_id
    if (!imageId) return ''
    const id = item.master?.id || item.param?.id || item.id
    if (!id || !imageId.startsWith(String(id))) return ''
    return imageId.slice(String(id).length)
  }

  function getCharModifiers(item: RawPartyItem): { awakening: string | null; perpetuity: boolean } {
    const arousalForm = item.param?.npc_arousal_form
    const awakeningSlug = arousalForm ? CHARACTER_AWAKENING_MAPPING[Number(arousalForm)] : null
    const hasPerpetuit = !!item.param?.has_npcaugment_constant
    return {
      awakening: awakeningSlug && awakeningSlug !== 'character-balanced' ? awakeningSlug : null,
      perpetuity: hasPerpetuit
    }
  }

  function resolveSummonId(item: RawPartyItem): string {
    return resolveForgedSummonId(item.master?.id || item.param?.id || item.id || '')
  }
</script>

{#if !job?.master?.id && characters.length === 0 && weapons.length === 0 && summons.length === 0}
  <p class="cache-empty">{m.party_no_data()}</p>
{:else}
  {#if job?.master?.id || accessoryIds.length > 0}
    <div class="party-section">
      <h3 class="party-section-title">{m.party_section_job()}</h3>
      <div class="job-row">
        {#if job?.master?.id}
          <Tooltip content={job.master.name || m.party_section_job()}>
            <div class="wide-item">
              <img src={getImageUrl(`${BUCKET.jobWide}/${job.master.id}_a.jpg`)} alt={job.master.name || m.party_section_job()}>
            </div>
          </Tooltip>
        {/if}
        {#each accessoryIds as id}
          <div class="grid-item">
            <img src={getImageUrl(`${BUCKET.accessorySquare}/${id}.jpg`)} alt="">
          </div>
        {/each}
      </div>
      {#if setAction.length > 0}
        <div class="job-skills-list">
          {#each setAction as skill}
            {@const slug = jobSkillSlugs[skill.name]}
            <div class="job-skill-item" class:empty={!skill.name}>
              {#if slug}
                <img src={getImageUrl(`${BUCKET.jobSkills}/${slug}.png`)} alt={skill.name}>
              {:else}
                <div class="job-skill-placeholder"></div>
              {/if}
              <span>{skill.name || m.job_skill_empty()}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if characters.length > 0}
    <div class="party-section">
      <h3 class="party-section-title">{m.party_section_characters()}</h3>
      <div class="character-grid">
        {#each characters as item}
          {@const id = item.master?.id || item.param?.id || item.id}
          {@const suffix = getCharImageSuffix(item)}
          {@const mods = getCharModifiers(item)}
          <div class="grid-item">
            <CharacterModifiers perpetuity={mods.perpetuity} awakening={mods.awakening} />
            <img
              src={getImageUrl(`${BUCKET.characterMain}/${id}${suffix}.jpg`)}
              alt=""
              onerror={nextCharacterArt}
            >
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if weapons.length > 0}
    <div class="party-section">
      <h3 class="party-section-title">{m.party_section_weapons()}</h3>
      <div class="weapon-layout">
        {#if mainWeapon}
          {@const mainId = mainWeapon.master?.id || mainWeapon.param?.id || mainWeapon.id}
          {@const mainSuffix = getImageSuffix(mainWeapon)}
          {@const mainMods = getWeaponModifiers(mainWeapon, weaponKeyMap)}
          <div class="weapon-mainhand">
            <WeaponModifiers mods={mainMods} {weaponStatModifiers} />
            <img src={getImageUrl(`${BUCKET.weaponMain}/${mainId}${mainSuffix}.jpg`)} alt="">
          </div>
        {/if}
        <div class="weapon-grid">
          {#each gridWeapons as item}
            {@const id = item.master?.id || item.param?.id || item.id}
            {@const suffix = getImageSuffix(item)}
            {@const wMods = getWeaponModifiers(item, weaponKeyMap)}
            <div class="grid-item">
              <WeaponModifiers mods={wMods} {weaponStatModifiers} />
              <img src={getImageUrl(`${BUCKET.weaponGrid}/${id}${suffix}.jpg`)} alt="">
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if summons.length > 0 || subSummons.length > 0 || friendSummon || friendSummonName}
    <div class="party-section">
      <h3 class="party-section-title">{m.party_section_summons()}</h3>
      <div class="summon-layout">
        {#if mainSummon}
          {@const id = resolveSummonId(mainSummon)}
          {@const suffix = getImageSuffix(mainSummon)}
          <div class="summon-main">
            <img src={getImageUrl(`${BUCKET.summonTall}/${id}${suffix}.jpg`)} alt="">
          </div>
        {:else}
          <div class="summon-main">
            <img class="summon-placeholder" src={getImageUrl(`${BUCKET.placeholders}/placeholder-summon-main.png`)} alt="">
          </div>
        {/if}
        <div class="summon-grid">
          {#each allSubSummonSlots as item, i (i)}
            {#if item}
              {@const id = resolveSummonId(item)}
              {@const suffix = getImageSuffix(item)}
              {@const isQuick = quickSummonId && String(item.param?.id) === String(quickSummonId)}
              <div class="grid-item">
                {#if isQuick}
                  <div class="summon-modifiers">
                    <Tooltip content={m.stat_quick_summon()}><img class="quick-summon-badge" src="icons/quick-summon/filled.svg" alt={m.stat_quick_summon()}></Tooltip>
                  </div>
                {/if}
                <img src={getImageUrl(`${BUCKET.summonGrid}/${id}${suffix}.jpg`)} alt="">
              </div>
            {:else}
              <div class="grid-item">
                <img src={getImageUrl(`${BUCKET.placeholders}/placeholder-summon-grid.png`)} alt="">
              </div>
            {/if}
          {/each}
        </div>
        {#if friendSummon}
          <div class="summon-friend">
            <img src={friendArtUrl} alt="" onerror={nextFriendArt}>
          </div>
        {:else if !friendSummonPending}
          <div class="summon-friend">
            <img class="summon-placeholder" src={getImageUrl(`${BUCKET.placeholders}/placeholder-summon-main.png`)} alt="">
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if bullets.length > 0}
    <div class="party-section">
      <h3 class="party-section-title">{m.count_bullets({ count: bullets.length })}</h3>
      <div class="item-grid bullets">
        {#each bullets as bullet}
          <Tooltip content={bullet.name || ''} disabled={!bullet.name}>
          <div class="grid-item">
            <img src={getImageUrl(`${BUCKET.bulletSquare}/${bullet.bullet_id}.jpg`)} alt={bullet.name || ''}>
          </div>
          </Tooltip>
        {/each}
      </div>
    </div>
  {/if}
{/if}
