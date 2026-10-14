/**
 * The lookups a captured party deck needs before PartyDetail can label it:
 * the support summon (looked up by name), the weapon key names, the job
 * skill slugs and the weapon stat modifiers.
 */

import { partyLookups, type PartyDeckData } from './detail-data.js'
import { getLocale } from './i18n.js'
import {
  fetchJobSkillSlugs,
  fetchWeaponKeyMap,
  fetchWeaponStatModifiers,
  searchSummonByName
} from './services/chrome-messages.js'
import type {
  JobSkillSlugs,
  SummonSearchResult,
  WeaponKeyMap,
  WeaponStatModifiers
} from './types/messages.js'

export interface PartyDeckLookups {
  friendSummon: SummonSearchResult | null
  weaponKeyMap: WeaponKeyMap | null
  jobSkillSlugs: JobSkillSlugs
  weaponStatModifiers: WeaponStatModifiers | null
}

/** Whether the deck names a support summon that needs looking up. */
export function hasFriendSummon(party: PartyDeckData | undefined): boolean {
  return !!partyLookups(party).summonName
}

/**
 * Runs the lookups for one deck. Set `friendSummon: false` for decks that
 * can't have a support summon (Evoking Solomonis).
 */
export async function loadPartyDeckLookups(
  party: PartyDeckData | undefined,
  { friendSummon = true }: { friendSummon?: boolean } = {}
): Promise<PartyDeckLookups> {
  const { summonName, skillNames } = partyLookups(party)
  const [summon, weaponKeyMap, jobSkillSlugs, weaponStatModifiers] =
    await Promise.all([
      friendSummon && summonName
        ? searchSummonByName(summonName)
        : Promise.resolve(null),
      fetchWeaponKeyMap(getLocale()),
      skillNames.length > 0
        ? fetchJobSkillSlugs(skillNames)
        : Promise.resolve({}),
      fetchWeaponStatModifiers()
    ])
  return { friendSummon: summon, weaponKeyMap, jobSkillSlugs, weaponStatModifiers }
}
