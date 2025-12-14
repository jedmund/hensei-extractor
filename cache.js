/**
 * @fileoverview Cache utility functions for the Granblue Fantasy Chrome extension.
 * Provides helper functions for formatting cache status and managing cache data.
 */

import { CACHE_TTL_MS, getDataTypeName } from './constants.js'

// Re-export for backward compatibility
export { CACHE_TTL_MS } from './constants.js'

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
        displayName: getDataTypeName(type),
        subtitle: null,
        ageText: 'No data',
        statusClass: 'unavailable'
      }
    } else if (info.isStale) {
      formatted[type] = {
        ...info,
        displayName: getDataTypeName(type),
        subtitle: null,
        ageText: 'Stale',
        statusClass: 'stale'
      }
    } else {
      const ageText = formatAge(info.age)
      let subtitle = null

      if (type.startsWith('list_') || type.startsWith('collection_')) {
        subtitle = `${info.totalItems} items · ${info.pageCount} pages`
      }

      formatted[type] = {
        ...info,
        displayName: getDataTypeName(type),
        subtitle,
        ageText,
        statusClass: 'available'
      }
    }
  }

  return formatted
}
