/**
 * Internationalization module for the Chrome extension.
 * Wraps Paraglide message functions to maintain backward-compatible API.
 */

import * as m from '../paraglide/messages.js'
import {
  getLocale as paraglideGetLocale,
  setLocale as paraglideSetLocale,
  type Locale as ParaglideLocale
} from '../paraglide/runtime.js'

export type Locale = 'en' | 'ja'

// ==========================================
// MESSAGE REGISTRY
// ==========================================

// Build a lookup from string keys to Paraglide message functions.
// This allows the existing t(key) API to delegate to Paraglide.
type MessageFn = ((params?: Record<string, unknown>) => string) &
  Record<string, unknown>

const registry: Record<string, MessageFn> = {}
for (const [key, fn] of Object.entries(m)) {
  if (typeof fn === 'function' && key !== 'm') {
    registry[key] = fn as MessageFn
  }
}

// ==========================================
// SERIES NAME LOOKUP MAPS
// ==========================================

const WEAPON_SERIES_I18N: Record<string, string> = {
  Seraphic: 'series_seraphic',
  Grand: 'series_grand',
  'Dark Opus': 'series_dark_opus',
  Revenant: 'series_revenant',
  Primal: 'series_primal',
  Beast: 'series_beast',
  Regalia: 'series_regalia',
  Omega: 'series_omega',
  'Olden Primal': 'series_olden_primal',
  Hollowsky: 'series_hollowsky',
  Xeno: 'series_xeno',
  Rose: 'series_rose',
  Ultima: 'series_ultima',
  Bahamut: 'series_bahamut',
  Epic: 'series_epic',
  Cosmos: 'series_cosmos',
  Superlative: 'series_superlative',
  Vintage: 'series_vintage',
  'Class Champion': 'series_class_champion',
  Replica: 'series_replica',
  Relic: 'series_relic',
  Rusted: 'series_rusted',
  Sephira: 'series_sephira',
  Vyrmament: 'series_vyrmament',
  Upgrader: 'series_upgrader',
  Astral: 'series_astral',
  Draconic: 'series_draconic',
  'Eternal Splendor': 'series_eternal_splendor',
  Ancestral: 'series_ancestral',
  'New World Foundation': 'series_new_world',
  Ennead: 'series_ennead',
  Militis: 'series_militis',
  Malice: 'series_malice',
  Menace: 'series_menace',
  Illustrious: 'series_illustrious',
  Proven: 'series_proven',
  Revans: 'series_revans',
  World: 'series_world',
  Exo: 'series_exo',
  'Draconic Providence': 'series_draconic_providence',
  Celestial: 'series_celestial',
  'Omega Rebirth': 'series_omega_rebirth',
  Collab: 'series_collab',
  Destroyer: 'series_destroyer'
}

const SUMMON_SERIES_I18N: Record<string, string> = {
  Providence: 'series_providence',
  Genesis: 'series_genesis',
  Magna: 'series_magna',
  Optimus: 'series_optimus',
  'Demi Optimus': 'series_demi_optimus',
  Archangel: 'series_archangel',
  Arcarum: 'series_arcarum',
  Epic: 'series_epic',
  Carbuncle: 'series_carbuncle',
  Dynamis: 'series_dynamis',
  Cryptid: 'series_cryptid',
  'Six Dragons': 'series_six_dragons',
  Summer: 'series_summer',
  Yukata: 'series_yukata',
  Holiday: 'series_holiday',
  Collab: 'series_collab',
  Bellum: 'series_bellum',
  Crest: 'series_crest',
  Robur: 'series_robur'
}

const CHARACTER_SERIES_I18N: Record<string, string> = {
  Summer: 'series_summer',
  Yukata: 'series_yukata',
  Valentine: 'series_valentine',
  Halloween: 'series_halloween',
  Holiday: 'series_holiday',
  Zodiac: 'series_zodiac',
  Grand: 'series_grand',
  Fantasy: 'series_fantasy',
  Collab: 'series_collab',
  Eternal: 'series_eternal',
  Evoker: 'series_evoker',
  Saint: 'series_saint',
  Formal: 'series_formal'
}

// ==========================================
// PUBLIC API
// ==========================================

export function setLocale(lang: string): void {
  const locale = lang === 'ja' ? 'ja' : 'en'
  paraglideSetLocale(locale as ParaglideLocale, { reload: false })
}

export function getLocale(): Locale {
  return paraglideGetLocale() as Locale
}

export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  const fn = registry[key]
  if (!fn) return key
  return fn(params)
}

export function tPlural(
  singular: string,
  plural: string,
  count: number,
  params: Record<string, string | number> = {}
): string {
  const key = count === 1 ? singular : plural
  return t(key, { count, ...params })
}

export function tError(code: string): string {
  const key = `error_${code}`
  return registry[key] ? t(key) : t('error_request_failed')
}

export function translateSeries(
  englishName: string,
  type: 'weapon' | 'summon' | 'character'
): string {
  if (getLocale() === 'en') return englishName

  let map: Record<string, string>
  if (type === 'weapon') map = WEAPON_SERIES_I18N
  else if (type === 'summon') map = SUMMON_SERIES_I18N
  else if (type === 'character') map = CHARACTER_SERIES_I18N
  else return englishName

  const key = map[englishName]
  if (!key) return englishName

  return registry[key] ? t(key) : englishName
}

export function translateElement(englishName: string): string {
  if (getLocale() === 'en') return englishName
  const key = `element_${englishName.toLowerCase()}`
  return registry[key] ? t(key) : englishName
}

export function translateProficiency(englishName: string): string {
  if (getLocale() === 'en') return englishName
  const key = `proficiency_${englishName.toLowerCase()}`
  return registry[key] ? t(key) : englishName
}

export function translatePage(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n
    if (!key) return
    const translated = t(key)
    if (translated !== key) {
      el.textContent = translated
    }
  })

  document
    .querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')
    .forEach((el) => {
      const key = el.dataset.i18nPlaceholder
      if (!key) return
      const translated = t(key)
      if (translated !== key) {
        el.placeholder = translated
      }
    })

  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle
    if (!key) return
    const translated = t(key)
    if (translated !== key) {
      el.title = translated
    }
  })
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
