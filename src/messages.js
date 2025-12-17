/**
 * @fileoverview Message handling from background script.
 */

import { getDataTypeName, TAB_DATA_TYPES } from "../constants.js"
import { showTabStatus, hideTabStatus } from "./helpers.js"

/**
 * Create message handler
 * @param {object} handlers - Handler functions
 * @returns {function} Message handler function
 */
export function createMessageHandler(handlers) {
  const { refreshAllCaches, refreshDetailViewWithNewData, detailViewActive, currentDetailDataType } = handlers

  return function handleMessages(message) {
    if (message.action === 'dataCaptured') {
      // Refresh cache status
      refreshAllCaches()

      // If detail view is open and showing this data type, refresh it
      if (detailViewActive() && currentDetailDataType() === message.dataType) {
        refreshDetailViewWithNewData()
      }

      // Show notification on the appropriate tab
      const tabName = getTabForDataType(message.dataType)
      if (tabName) {
        showTabStatus(tabName, `${getDataTypeName(message.dataType)} data captured!`, 'success')
        setTimeout(() => hideTabStatus(tabName), 2000)
      }
    }
  }
}

/**
 * Get which tab a data type belongs to
 */
export function getTabForDataType(dataType) {
  if (dataType.startsWith('party_')) {
    return 'party'
  }
  for (const [tab, types] of Object.entries(TAB_DATA_TYPES)) {
    if (types.includes(dataType)) return tab
  }
  return null
}
