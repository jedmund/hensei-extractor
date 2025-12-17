/**
 * @fileoverview Cache display and management UI.
 */

import { formatCacheStatus } from "../cache.js"
import { TAB_DATA_TYPES } from "../constants.js"
import { showTabStatus, hideTabStatus } from "./helpers.js"

// Cache state
export let cachedStatus = null

// Selected data types per tab
export let selectedDataTypes = {
  party: null,
  collection: null,
  database: null
}

/**
 * Set cached status (for external updates)
 */
export function setCachedStatus(status) {
  cachedStatus = status
}

/**
 * Refresh cache status for all tabs
 */
export async function refreshAllCaches() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCacheStatus' })

    if (response?.error) {
      console.error('Cache status error:', response.error)
      cachedStatus = {}
    } else {
      cachedStatus = formatCacheStatus(response || {})
    }
  } catch (error) {
    console.error('Error refreshing cache:', error)
    cachedStatus = {}
  }

  // Always update all data tabs
  updateTabCacheDisplay('party', cachedStatus)
  updateTabCacheDisplay('collection', cachedStatus)
  updateTabCacheDisplay('database', cachedStatus)
}

/**
 * Update cache display for a specific tab
 * @param {string} tabName - Tab name
 * @param {object} status - Cache status object
 * @param {function} showDetailView - Detail view function (optional)
 */
export function updateTabCacheDisplay(tabName, status, showDetailView) {
  const container = document.getElementById(`${tabName}Items`)
  if (!container) return

  let typesToDisplay = []
  if (tabName === 'party') {
    typesToDisplay = Object.keys(status || {})
      .filter(type => type.startsWith('party_') && status[type]?.available)
  } else if (tabName === 'database') {
    typesToDisplay = Object.keys(status || {})
      .filter(type =>
        (type.startsWith('detail_npc_') ||
         type.startsWith('detail_weapon_') ||
         type.startsWith('detail_summon_')) &&
        status[type]?.available
      )
  } else {
    typesToDisplay = (TAB_DATA_TYPES[tabName] || [])
      .filter(type => status?.[type]?.available)
  }

  // Sort by lastUpdated descending
  typesToDisplay.sort((a, b) => {
    const aTime = status[a]?.lastUpdated || 0
    const bTime = status[b]?.lastUpdated || 0
    return bTime - aTime
  })

  if (typesToDisplay.length === 0) {
    container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    return
  }

  let html = ''

  for (const type of typesToDisplay) {
    const info = status[type]
    if (!info?.available) continue

    const displayName = info.partyName || info.displayName

    const subtitleHtml = info.subtitle
      ? `<span class="cache-subtitle">${info.subtitle}</span>`
      : ''

    html += `
      <div class="cache-item ${info.statusClass}" data-type="${type}" data-tab="${tabName}">
        <div class="cache-info">
          <span class="cache-name">${displayName}</span>
          ${subtitleHtml}
        </div>
        <div class="cache-right">
          <span class="cache-age">${info.ageText}</span>
          <button class="cache-detail-btn" data-type="${type}" aria-label="View details">
            <svg class="icon-chevron" viewBox="0 0 14 14" fill="currentColor">
              <path d="M4.17094 2.04309C4.56138 1.6528 5.1945 1.6529 5.585 2.04309L9.82719 6.28625C9.9998 6.45893 10.0963 6.67885 10.1162 6.90442C10.1436 7.19118 10.0468 7.48755 9.82719 7.70715L5.585 11.9503C5.19455 12.3402 4.56133 12.3403 4.17094 11.9503C3.78079 11.5599 3.78097 10.9267 4.17094 10.5363L7.70902 6.99622L4.17094 3.45715C3.78082 3.06673 3.78088 2.43355 4.17094 2.04309Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
    `
  }

  container.innerHTML = html

  // Add click handlers for rows
  container.querySelectorAll('.cache-item[data-type]').forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('stale')) return
      if (showDetailView) {
        showDetailView(item.dataset.type)
      }
    })
  })
}

/**
 * Get empty message for a tab
 */
function getEmptyMessage(tabName) {
  switch (tabName) {
    case 'party': return 'Browse a party in game to capture data'
    case 'collection': return 'Browse your collection pages to capture data'
    case 'database': return 'Browse detail pages to capture data'
    default: return 'No data available'
  }
}

/**
 * Handle clear cache
 */
export async function handleClearCache(activeTab) {
  await chrome.runtime.sendMessage({ action: 'clearCache' })
  selectedDataTypes = { party: null, collection: null, database: null }
  cachedStatus = null

  for (const tabName of ['party', 'collection', 'database']) {
    const container = document.getElementById(`${tabName}Items`)
    if (container) {
      container.innerHTML = `<p class="cache-empty">${getEmptyMessage(tabName)}</p>`
    }
  }

  showTabStatus(activeTab, 'Cache cleared', 'info')
  setTimeout(() => hideTabStatus(activeTab), 2000)
}
