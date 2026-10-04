<script lang="ts">
  import { BUCKET, getImageUrl } from '../../../lib/constants.js'
  import {
    resolveAwakeningIcon,
    resolveAugmentIcon,
    buildAxTooltipLines,
    type WeaponModifiers,
    type WeaponStatModifier
  } from '../../../lib/detail-helpers.js'
  import { getLocale } from '../../../lib/i18n.js'
  import * as m from '../../../paraglide/messages.js'
  import Tooltip from '../../shared/Tooltip.svelte'
  import RichTooltip from '../../shared/RichTooltip.svelte'

  /**
   * Badges over a weapon's art: awakening, AX skill or befoulment, and weapon
   * keys. Sizing and placement come from the cell it sits in (mainhand, grid
   * cell, or a selectable collection cell); see "Weapon Modifiers" in
   * _detail.scss.
   */
  interface Props {
    mods: WeaponModifiers
    weaponStatModifiers?: Record<string, WeaponStatModifier> | null
  }

  let { mods, weaponStatModifiers = null }: Props = $props()
</script>

{#if mods.awakening || mods.axSkill || mods.befoulment || mods.weaponKeys.length > 0}
  <div class="weapon-modifiers">
    {#if mods.awakening}
      <Tooltip content="{mods.awakening.form_name} Lv.{mods.awakening.level}"><img class="awakening-icon" src={getImageUrl(`${BUCKET.awakening}/${resolveAwakeningIcon(mods.awakening.form_name)}.png`)} alt={m.stat_awakening()}></Tooltip>
    {/if}
    {#if mods.axSkill || mods.befoulment || mods.weaponKeys.length > 0}
      <div class="weapon-skills">
        {#if mods.axSkill}
          {@const axIcon = resolveAugmentIcon(mods.axSkill.iconImage || 'ex_skill_atk')}
          <RichTooltip>
            {#snippet content()}{#each buildAxTooltipLines(mods.axSkill!.skill, mods.axSkill!.iconImage, weaponStatModifiers, getLocale()) as line}<div>{line}</div>{/each}{/snippet}
            <img class="ax-skill-icon" src={getImageUrl(`${BUCKET.axSkills}/${axIcon}.png`)} alt={m.stat_ax_skills()}>
          </RichTooltip>
        {/if}
        {#if mods.befoulment}
          {@const befoulIcon = resolveAugmentIcon(mods.befoulment.iconImage || 'ex_skill_def_down')}
          <RichTooltip>
            {#snippet content()}<div>{m.stat_befoulment()}: {mods.befoulment!.showValue || m.stat_befouled()}</div><div>{m.stat_exorcism()} {mods.befoulment!.exorcismLevel}/{mods.befoulment!.maxExorcismLevel}</div>{/snippet}
            <img class="befoulment-icon" src={getImageUrl(`${BUCKET.axSkills}/${befoulIcon}.png`)} alt={m.stat_befoulment()}>
          </RichTooltip>
        {/if}
        {#each mods.weaponKeys as key}
          <Tooltip content={key.name}><img class="weapon-key-icon" src={getImageUrl(`${BUCKET.weaponKeys}/${key.slug}.png`)} alt={key.name}></Tooltip>
        {/each}
      </div>
    {/if}
  </div>
{/if}
