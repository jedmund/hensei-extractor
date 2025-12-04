/**
 * @fileoverview Cache utility functions for the Granblue Fantasy Chrome extension.
 * Provides helper functions for formatting cache status and managing cache data.
 */

// Cache TTL in milliseconds (30 minutes)
export const CACHE_TTL_MS = 30 * 60 * 1000

// Data type display names
export const DATA_TYPE_NAMES = {
  party: 'Party',
  detail_npc: 'Character',
  detail_weapon: 'Weapon',
  detail_summon: 'Summon',
  list_npc: 'Character List',
  list_weapon: 'Weapon List',
  list_summon: 'Summon List',
  collection_weapon: 'Weapon Collection',
  collection_npc: 'Character Collection',
  collection_summon: 'Summon Collection',
  collection_artifact: 'Artifact Collection'
}

/**
 * Format a timestamp age into a human-readable string
 * @param {number} ageMs - Age in milliseconds
 * @returns {string} Formatted age string
 */
export function formatAge(ageMs) {
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
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
    if (!info.available) {
      formatted[type] = {
        ...info,
        displayName: DATA_TYPE_NAMES[type] || type,
        statusText: 'No data',
        statusClass: 'unavailable'
      }
    } else if (info.isStale) {
      formatted[type] = {
        ...info,
        displayName: DATA_TYPE_NAMES[type] || type,
        statusText: 'Stale - refresh needed',
        statusClass: 'stale'
      }
    } else {
      const ageText = formatAge(info.age)
      let statusText = ageText

      if (type.startsWith('list_')) {
        statusText = `${info.totalItems} items (${info.pageCount} pages) - ${ageText}`
      }

      formatted[type] = {
        ...info,
        displayName: DATA_TYPE_NAMES[type] || type,
        statusText: statusText,
        statusClass: 'available'
      }
    }
  }

  return formatted
}

/**
 * Get appropriate icon for data type
 * @param {string} dataType - The data type
 * @returns {string} Icon character or emoji
 */
export function getDataTypeIcon(dataType) {
  const icons = {
    party: '⚔️',
    detail_npc: '👤',
    detail_weapon: '🗡️',
    detail_summon: '✨',
    list_npc: '👥',
    list_weapon: '🗡️',
    list_summon: '✨',
    collection_weapon: '🗡️',
    collection_npc: '👥',
    collection_summon: '✨',
    collection_artifact: '💎'
  }
  return icons[dataType] || '📄'
}
