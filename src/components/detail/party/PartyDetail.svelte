<script lang="ts">
  import { getImageUrl } from '../../../lib/constants.js'
  import {
    toArray,
    getWeaponModifiers,
    resolveAwakeningIcon,
    resolveAugmentIcon,
    buildAxTooltip,
    type WeaponStatModifier
  } from '../../../lib/detail-helpers.js'
  import { getLocale } from '../../../lib/i18n.js'
  import {
    CHARACTER_AWAKENING_MAPPING,
    resolveForgedSummonId
  } from '../../../lib/game-data.js'
  import * as m from '../../../paraglide/messages.js'

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
    imageSuffix?: string
    name?: { en?: string; ja?: string }
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
    weaponKeyMap?: Record<string, string> | null
    jobSkillSlugs?: Record<string, string>
    weaponStatModifiers?: Record<string, WeaponStatModifier> | null
    simplePortraits?: boolean
  }

  let {
    data: rawData,
    friendSummon = null,
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
  let setAction = $derived(pc?.set_action || [])

  let mainWeapon = $derived(weapons[0])
  let gridWeapons = $derived(weapons.slice(1))
  let mainSummon = $derived(summons[0])
  let allSubSummons = $derived([...summons.slice(1), ...subSummons])

  let bulletInfo = $derived(data?.bullet_info?.set_bullets)
  let bullets = $derived.by((): BulletEntry[] => {
    if (!bulletInfo) return []
    return Object.entries(bulletInfo)
      .filter(([key]) => key.startsWith('bullet_'))
      .map(([, bullet]) => bullet)
      .filter((b): b is BulletEntry => !!b && !!b.bullet_id)
  })

  function getCharImageSuffix(item: RawPartyItem): string {
    if (item.param?.style === '2') return '_01_style'
    const evolution = item.param?.evolution
    const phase = item.param?.phase
    if (phase && phase > 0) return '_04'
    if (evolution && evolution >= 5) return '_03'
    if (evolution && evolution > 2) return simplePortraits ? '_01' : '_02'
    return '_01'
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
          <div class="wide-item">
            <img src={getImageUrl(`job-wide/${job.master.id}_a.jpg`)} alt={job.master.name || m.party_section_job()}>
          </div>
        {/if}
        {#each accessoryIds as id}
          <div class="grid-item">
            <img src={getImageUrl(`accessory-square/${id}.jpg`)} alt="">
          </div>
        {/each}
      </div>
      {#if setAction.length > 0}
        <div class="job-skills-list">
          {#each setAction as skill}
            {@const slug = jobSkillSlugs[skill.name]}
            <div class="job-skill-item">
              {#if slug}
                <img src={getImageUrl(`job-skills/${slug}.png`)} alt={skill.name}>
              {:else}
                <div class="job-skill-placeholder"></div>
              {/if}
              <span>{skill.name}</span>
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
            {#if mods.awakening || mods.perpetuity}
              <div class="char-modifiers">
                {#if mods.perpetuity}
                  <img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt={m.stat_perpetuity_ring()} data-tooltip={m.stat_perpetuity_ring()}>
                {/if}
                {#if mods.awakening}
                  <img class="awakening-icon" src={getImageUrl(`awakening/${mods.awakening}.jpg`)} alt={m.stat_awakening()} data-tooltip={m.stat_awakening()}>
                {/if}
              </div>
            {/if}
            <img src={getImageUrl(`character-main/${id}${suffix}.jpg`)} alt="">
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
            {#if mainMods.awakening || mainMods.axSkill || mainMods.befoulment || mainMods.weaponKeys.length > 0}
              <div class="weapon-modifiers">
                {#if mainMods.awakening}
                  <img class="awakening-icon" src={getImageUrl(`awakening/${resolveAwakeningIcon(mainMods.awakening.form_name)}.png`)} alt={m.stat_awakening()} data-tooltip="{mainMods.awakening.form_name} Lv.{mainMods.awakening.level}">
                {/if}
                {#if mainMods.axSkill || mainMods.befoulment || mainMods.weaponKeys.length > 0}
                  <div class="weapon-skills">
                    {#if mainMods.axSkill}
                      {@const axIcon = resolveAugmentIcon(mainMods.axSkill.iconImage || 'ex_skill_atk')}
                      <img class="ax-skill-icon" src={getImageUrl(`ax/${axIcon}.png`)} alt={m.stat_ax_skills()} data-tooltip={buildAxTooltip(mainMods.axSkill.skill, mainMods.axSkill.iconImage, weaponStatModifiers, getLocale())}>
                    {/if}
                    {#if mainMods.befoulment}
                      {@const befoulIcon = resolveAugmentIcon(mainMods.befoulment.iconImage || 'ex_skill_def_down')}
                      <img class="befoulment-icon" src={getImageUrl(`ax/${befoulIcon}.png`)} alt={m.stat_befoulment()} data-tooltip="<div>{m.stat_befoulment()}: {mainMods.befoulment.skill?.show_value || 'Befouled'}</div><div>{m.stat_exorcism()} {mainMods.befoulment.exorcismLevel}/{mainMods.befoulment.maxExorcismLevel}</div>">
                    {/if}
                    {#each mainMods.weaponKeys as slug}
                      <img class="weapon-key-icon" src={getImageUrl(`weapon-keys/${slug}.png`)} alt={slug} data-tooltip={slug}>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
            <img src={getImageUrl(`weapon-main/${mainId}${mainSuffix}.jpg`)} alt="">
          </div>
        {/if}
        <div class="weapon-grid">
          {#each gridWeapons as item}
            {@const id = item.master?.id || item.param?.id || item.id}
            {@const suffix = getImageSuffix(item)}
            {@const wMods = getWeaponModifiers(item, weaponKeyMap)}
            <div class="grid-item">
              {#if wMods.awakening || wMods.axSkill || wMods.befoulment || wMods.weaponKeys.length > 0}
                <div class="weapon-modifiers">
                  {#if wMods.awakening}
                    <img class="awakening-icon" src={getImageUrl(`awakening/${resolveAwakeningIcon(wMods.awakening.form_name)}.png`)} alt={m.stat_awakening()} data-tooltip="{wMods.awakening.form_name} Lv.{wMods.awakening.level}">
                  {/if}
                  {#if wMods.axSkill || wMods.befoulment || wMods.weaponKeys.length > 0}
                    <div class="weapon-skills">
                      {#if wMods.axSkill}
                        {@const axIcon = resolveAugmentIcon(wMods.axSkill.iconImage || 'ex_skill_atk')}
                        <img class="ax-skill-icon" src={getImageUrl(`ax/${axIcon}.png`)} alt={m.stat_ax_skills()} data-tooltip={buildAxTooltip(wMods.axSkill.skill, wMods.axSkill.iconImage, weaponStatModifiers, getLocale())}>
                      {/if}
                      {#if wMods.befoulment}
                        {@const befoulIcon = resolveAugmentIcon(wMods.befoulment.iconImage || 'ex_skill_def_down')}
                        <img class="befoulment-icon" src={getImageUrl(`ax/${befoulIcon}.png`)} alt={m.stat_befoulment()} data-tooltip="<div>{m.stat_befoulment()}: {wMods.befoulment.skill?.show_value || 'Befouled'}</div><div>{m.stat_exorcism()} {wMods.befoulment.exorcismLevel}/{wMods.befoulment.maxExorcismLevel}</div>">
                      {/if}
                      {#each wMods.weaponKeys as slug}
                        <img class="weapon-key-icon" src={getImageUrl(`weapon-keys/${slug}.png`)} alt={slug} data-tooltip={slug}>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
              <img src={getImageUrl(`weapon-grid/${id}${suffix}.jpg`)} alt="">
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if summons.length > 0 || subSummons.length > 0 || friendSummon}
    <div class="party-section">
      <h3 class="party-section-title">{m.party_section_summons()}</h3>
      <div class="summon-layout">
        {#if mainSummon}
          {@const id = resolveSummonId(mainSummon)}
          {@const suffix = getImageSuffix(mainSummon)}
          <div class="summon-main">
            <img src={getImageUrl(`summon-tall/${id}${suffix}.jpg`)} alt="">
          </div>
        {/if}
        <div class="summon-grid">
          {#each allSubSummons as item}
            {@const id = resolveSummonId(item)}
            {@const suffix = getImageSuffix(item)}
            {@const isQuick = quickSummonId && String(item.param?.id) === String(quickSummonId)}
            <div class="grid-item">
              {#if isQuick}
                <div class="summon-modifiers">
                  <img class="quick-summon-badge" src="icons/quick-summon/filled.svg" alt={m.stat_quick_summon()} data-tooltip={m.stat_quick_summon()}>
                </div>
              {/if}
              <img src={getImageUrl(`summon-grid/${id}${suffix}.jpg`)} alt="">
            </div>
          {/each}
        </div>
        {#if friendSummon}
          <div class="summon-friend">
            <img src={getImageUrl(`summon-tall/${friendSummon.granblue_id}${friendSummon.imageSuffix || ''}.jpg`)} alt="">
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
          <div class="grid-item" data-tooltip={bullet.name || ''}>
            <img src={getImageUrl(`bullet-square/${bullet.bullet_id}.jpg`)} alt={bullet.name || ''}>
          </div>
        {/each}
      </div>
    </div>
  {/if}
{/if}
