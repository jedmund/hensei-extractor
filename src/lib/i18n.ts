/**
 * Internationalization module for the Chrome extension.
 * Thin wrapper around Paraglide runtime for locale management
 * and series/element/proficiency name translation.
 */

import * as m from '../paraglide/messages.js'
import {
  getLocale as paraglideGetLocale,
  setLocale as paraglideSetLocale,
  type Locale as ParaglideLocale
} from '../paraglide/runtime.js'

export type Locale = 'en' | 'ja'

// ==========================================
// LOCALE MANAGEMENT
// ==========================================

export function setLocale(lang: string): void {
  const locale = lang === 'ja' ? 'ja' : 'en'
  paraglideSetLocale(locale as ParaglideLocale, { reload: false })
}

export function getLocale(): Locale {
  return paraglideGetLocale() as Locale
}

interface AuthWithLanguage {
  language?: string
}

export function getPreferredLocale(gbAuth: AuthWithLanguage | null): Locale {
  if (gbAuth?.language === 'ja') return 'ja'
  if (gbAuth?.language === 'en') return 'en'
  try {
    const uiLang = chrome.i18n?.getUILanguage?.() ?? navigator.language ?? 'en'
    return uiLang.startsWith('ja') ? 'ja' : 'en'
  } catch {
    return 'en'
  }
}

// ==========================================
// ERROR CODE TRANSLATION
// ==========================================

const ERROR_MESSAGES: Record<string, () => string> = {
  not_logged_in: m.error_not_logged_in,
  no_cached_data: m.error_no_cached_data,
  stale_data: m.error_stale_data,
  no_character_stats: m.error_no_character_stats,
  no_items: m.error_no_items,
  unknown_type: m.error_unknown_type,
  request_failed: m.error_request_failed,
  server_error: m.error_server_error
}

export function translateError(code: string): string {
  const fn = ERROR_MESSAGES[code]
  return fn ? fn() : m.error_request_failed()
}

// ==========================================
// SERIES NAME TRANSLATION
// ==========================================

const WEAPON_SERIES: Record<string, () => string> = {
  Seraphic: m.series_seraphic,
  Grand: m.series_grand,
  'Dark Opus': m.series_dark_opus,
  Revenant: m.series_revenant,
  Primal: m.series_primal,
  Beast: m.series_beast,
  Regalia: m.series_regalia,
  Omega: m.series_omega,
  'Olden Primal': m.series_olden_primal,
  Hollowsky: m.series_hollowsky,
  Xeno: m.series_xeno,
  Rose: m.series_rose,
  Ultima: m.series_ultima,
  Bahamut: m.series_bahamut,
  Epic: m.series_epic,
  Cosmos: m.series_cosmos,
  Superlative: m.series_superlative,
  Vintage: m.series_vintage,
  'Class Champion': m.series_class_champion,
  Replica: m.series_replica,
  Relic: m.series_relic,
  Rusted: m.series_rusted,
  Sephira: m.series_sephira,
  Vyrmament: m.series_vyrmament,
  Upgrader: m.series_upgrader,
  Astral: m.series_astral,
  Draconic: m.series_draconic,
  'Eternal Splendor': m.series_eternal_splendor,
  Ancestral: m.series_ancestral,
  'New World Foundation': m.series_new_world,
  Ennead: m.series_ennead,
  Militis: m.series_militis,
  Malice: m.series_malice,
  Menace: m.series_menace,
  Illustrious: m.series_illustrious,
  Proven: m.series_proven,
  Revans: m.series_revans,
  World: m.series_world,
  Exo: m.series_exo,
  'Draconic Providence': m.series_draconic_providence,
  Celestial: m.series_celestial,
  'Omega Rebirth': m.series_omega_rebirth,
  Collab: m.series_collab,
  Destroyer: m.series_destroyer
}

const SUMMON_SERIES: Record<string, () => string> = {
  Providence: m.series_providence,
  Genesis: m.series_genesis,
  Magna: m.series_magna,
  Optimus: m.series_optimus,
  'Demi Optimus': m.series_demi_optimus,
  Archangel: m.series_archangel,
  Arcarum: m.series_arcarum,
  Epic: m.series_epic,
  Carbuncle: m.series_carbuncle,
  Dynamis: m.series_dynamis,
  Cryptid: m.series_cryptid,
  'Six Dragons': m.series_six_dragons,
  Summer: m.series_summer,
  Yukata: m.series_yukata,
  Holiday: m.series_holiday,
  Collab: m.series_collab,
  Bellum: m.series_bellum,
  Crest: m.series_crest,
  Robur: m.series_robur
}

const CHARACTER_SERIES: Record<string, () => string> = {
  Summer: m.series_summer,
  Yukata: m.series_yukata,
  Valentine: m.series_valentine,
  Halloween: m.series_halloween,
  Holiday: m.series_holiday,
  Zodiac: m.series_zodiac,
  Grand: m.series_grand,
  Fantasy: m.series_fantasy,
  Collab: m.series_collab,
  Eternal: m.series_eternal,
  Evoker: m.series_evoker,
  Saint: m.series_saint,
  Formal: m.series_formal
}

const ELEMENT_NAMES: Record<string, () => string> = {
  fire: m.element_fire,
  water: m.element_water,
  earth: m.element_earth,
  wind: m.element_wind,
  light: m.element_light,
  dark: m.element_dark
}

const PROFICIENCY_NAMES: Record<string, () => string> = {
  sabre: m.proficiency_sabre,
  dagger: m.proficiency_dagger,
  axe: m.proficiency_axe,
  spear: m.proficiency_spear,
  bow: m.proficiency_bow,
  staff: m.proficiency_staff,
  melee: m.proficiency_melee,
  harp: m.proficiency_harp,
  gun: m.proficiency_gun,
  katana: m.proficiency_katana
}

export function translateSeries(
  englishName: string,
  type: 'weapon' | 'summon' | 'character'
): string {
  if (getLocale() === 'en') return englishName

  let map: Record<string, () => string>
  if (type === 'weapon') map = WEAPON_SERIES
  else if (type === 'summon') map = SUMMON_SERIES
  else if (type === 'character') map = CHARACTER_SERIES
  else return englishName

  const fn = map[englishName]
  return fn ? fn() : englishName
}

export function translateElement(englishName: string): string {
  if (getLocale() === 'en') return englishName
  const fn = ELEMENT_NAMES[englishName.toLowerCase()]
  return fn ? fn() : englishName
}

export function translateProficiency(englishName: string): string {
  if (getLocale() === 'en') return englishName
  const fn = PROFICIENCY_NAMES[englishName.toLowerCase()]
  return fn ? fn() : englishName
}
