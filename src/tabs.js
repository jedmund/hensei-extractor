/**
 * @fileoverview Tab navigation logic.
 */

// Current active tab
export let activeTab = 'party'

/**
 * Switch to a different tab
 * @param {string} tabName - The tab to switch to
 * @param {function} updateCacheDisplay - Callback to update cache display
 * @param {object} cachedStatus - Current cache status
 */
export function switchTab(tabName, updateCacheDisplay, cachedStatus) {
  activeTab = tabName

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName)
  })

  // Update panels
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('active', p.id === `${tabName}Panel`)
  })

  // Refresh cache display for this tab
  if (cachedStatus && updateCacheDisplay) {
    updateCacheDisplay(tabName, cachedStatus)
  }
}

/**
 * Show/hide Database tab based on user role
 */
export function updateTabVisibility(userRole) {
  const databaseTab = document.getElementById('databaseTab')
  if (userRole >= 7) {
    databaseTab?.classList.remove('hidden')
  } else {
    databaseTab?.classList.add('hidden')
  }
}
