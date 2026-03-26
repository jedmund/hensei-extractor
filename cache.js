/**
 * @fileoverview Cache utility functions for the Granblue Fantasy Chrome extension.
 * Provides helper functions for formatting cache status and managing cache data.
 */

import { CACHE_TTL_MS, getDataTypeName } from './constants.js'
import { t } from './i18n.js'

/**
 * Format a timestamp age into a human-readable string
 * @param {number} ageMs - Age in milliseconds
 * @returns {string} Formatted age string
 */
export function formatAge(ageMs) {
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return t('time_seconds_ago', { count: seconds })

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('time_minutes_ago', { count: minutes })

  const hours = Math.floor(minutes / 60)
  return t('time_hours_ago', { count: hours })
}

/**
 * Check if cached data is stale
 * @param {number} timestamp - Cache timestamp
 * @returns {boolean} True if stale
 */
export function isStale(timestamp) {
  return Date.now() - timestamp > CACHE_TTL_MS
}

/**
 * Format cache status for display
 * @param {object} status - Cache status object from content script
 * @returns {object} Formatted status with display strings
 */
export function formatCacheStatus(status) {
  const formatted = {}

  for (const [type, info] of Object.entries(status)) {
    const stashDisplayName = (type.startsWith('stash_') && info.stashName)
      ? info.stashName
      : getDataTypeName(type)

    if (!info.available) {
      formatted[type] = {
        ...info,
        displayName: stashDisplayName,
        subtitle: null,
        ageText: t('cache_no_data'),
        statusClass: 'unavailable'
      }
    } else if (info.isStale) {
      formatted[type] = {
        ...info,
        displayName: stashDisplayName,
        subtitle: null,
        ageText: t('cache_stale'),
        statusClass: 'stale'
      }
    } else {
      const ageText = formatAge(info.age)
      let subtitle = null
      let displayName = stashDisplayName

      if (type.startsWith('list_') || type.startsWith('collection_') || type.startsWith('stash_')) {
        subtitle = t('count_items_pages', { items: info.totalItems, pages: info.pageCount })
      }

      // Handle per-item detail types (use item name as display name)
      if (type.startsWith('detail_npc_')) {
        displayName = info.itemName || t('type_character')
      } else if (type.startsWith('detail_weapon_')) {
        displayName = info.itemName || t('type_weapon')
      } else if (type.startsWith('detail_summon_')) {
        displayName = info.itemName || t('type_summon')
      }

      formatted[type] = {
        ...info,
        displayName,
        subtitle,
        ageText,
        statusClass: 'available'
      }
    }
  }

  return formatted
}
