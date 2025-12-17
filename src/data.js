/**
 * @fileoverview Data operations - copy, import, export handlers.
 */

import { getDataTypeName } from "../constants.js"
import { showTabStatus, hideTabStatus, capitalize, showToast } from "./helpers.js"
import { selectedItems, currentItemIndexMap } from "./selection.js"
import { isCollectionType, extractItems } from "./rendering.js"

/**
 * Filter collection data to only include selected items
 */
export function filterSelectedItems(dataType, data) {
  if (!isCollectionType(dataType)) return data

  const items = extractItems(dataType, data)
  const filteredItems = items.filter((_, i) => selectedItems.has(i))

  const result = {}
  let itemIndex = 0

  for (const [pageNum, pageData] of Object.entries(data)) {
    const pageItems = pageData.list || []
    const filteredPageItems = []

    for (const item of pageItems) {
      if (selectedItems.has(itemIndex)) {
        filteredPageItems.push(item)
      }
      itemIndex++
    }

    if (filteredPageItems.length > 0) {
      result[pageNum] = { ...pageData, list: filteredPageItems }
    }
  }

  return result
}

/**
 * Handle copy from detail view
 */
export async function handleDetailCopy(currentDetailDataType) {
  if (!currentDetailDataType) return

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Failed to copy')
      return
    }

    const dataToExport = filterSelectedItems(currentDetailDataType, response.data)
    const jsonString = JSON.stringify(dataToExport, null, 2)
    await navigator.clipboard.writeText(jsonString)

    if (isCollectionType(currentDetailDataType)) {
      showToast(`Copied ${selectedItems.size} items`)
    } else {
      showToast('Copied to clipboard')
    }
  } catch (error) {
    showToast('Failed to copy')
  }
}

/**
 * Handle import from detail view
 */
export async function handleDetailImport(currentDetailDataType) {
  if (!currentDetailDataType) return

  const importBtn = document.getElementById('detailImport')
  if (importBtn) {
    importBtn.disabled = true
    importBtn.textContent = 'Importing...'
  }

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType: currentDetailDataType
    })

    if (response.error) {
      showToast('Import failed')
      return
    }

    const dataToUpload = filterSelectedItems(currentDetailDataType, response.data)

    let uploadResponse
    if (currentDetailDataType.startsWith('party_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: dataToUpload
      })
    } else if (currentDetailDataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: dataToUpload,
        dataType: currentDetailDataType
      })
    } else if (currentDetailDataType.startsWith('collection_') || currentDetailDataType.startsWith('list_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: dataToUpload,
        dataType: currentDetailDataType,
        updateExisting: false
      })
    } else {
      showToast('Import not supported')
      return
    }

    if (uploadResponse.error) {
      showToast(uploadResponse.error)
    } else if (uploadResponse.url) {
      chrome.tabs.create({ url: uploadResponse.url })
      showToast('Opening party...')
    } else if (uploadResponse.created !== undefined) {
      const total = uploadResponse.created + uploadResponse.updated
      showToast(`Imported ${total} items`)
      if (importBtn) {
        importBtn.textContent = 'Imported'
        importBtn.classList.add('imported')
      }
    } else {
      showToast('Import successful')
      if (importBtn) {
        importBtn.textContent = 'Imported'
        importBtn.classList.add('imported')
      }
    }
  } catch (error) {
    showToast('Import failed')
  } finally {
    if (importBtn && !importBtn.classList.contains('imported')) {
      importBtn.disabled = false
      importBtn.textContent = 'Import'
    }
  }
}

/**
 * Handle export for a tab
 */
export async function handleExport(tabName, selectedDataTypes) {
  const dataType = selectedDataTypes[tabName]
  if (!dataType) {
    showTabStatus(tabName, 'Please select data to export', 'error')
    return
  }

  const exportBtn = document.getElementById(`export${capitalize(tabName)}`)
  if (exportBtn) exportBtn.disabled = true

  showTabStatus(tabName, 'Preparing export...', 'info')

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType
    })

    if (response.error) {
      showTabStatus(tabName, response.error, 'error')
      return
    }

    let uploadResponse
    if (dataType === 'party') {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadPartyData',
        data: response.data
      })
    } else if (dataType.startsWith('detail_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadDetailData',
        data: response.data,
        dataType
      })
    } else if (dataType.startsWith('collection_') || dataType.startsWith('list_')) {
      uploadResponse = await chrome.runtime.sendMessage({
        action: 'uploadCollectionData',
        data: response.data,
        dataType,
        updateExisting: false
      })
    } else {
      showTabStatus(tabName, 'Export not supported for this data type', 'error')
      return
    }

    if (uploadResponse.error) {
      showTabStatus(tabName, uploadResponse.error, 'error')
    } else if (uploadResponse.url) {
      chrome.tabs.create({ url: uploadResponse.url })
      window.close()
    } else if (uploadResponse.created !== undefined) {
      const msg = `Imported: ${uploadResponse.created} new, ${uploadResponse.updated} updated, ${uploadResponse.skipped} skipped`
      showTabStatus(tabName, msg, 'success')
      setTimeout(() => hideTabStatus(tabName), 4000)
    } else {
      showTabStatus(tabName, 'Export successful!', 'success')
      setTimeout(() => hideTabStatus(tabName), 2000)
    }
  } catch (error) {
    showTabStatus(tabName, 'Export failed: ' + error.message, 'error')
  } finally {
    if (exportBtn) exportBtn.disabled = false
  }
}

/**
 * Handle copy for a tab
 */
export async function handleCopy(tabName, selectedDataTypes) {
  const dataType = selectedDataTypes[tabName]
  if (!dataType) {
    showTabStatus(tabName, 'Please select data to copy', 'error')
    return
  }

  const copyBtn = document.getElementById(`copy${capitalize(tabName)}`)
  if (copyBtn) copyBtn.disabled = true

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCachedData',
      dataType
    })

    if (response.error) {
      showTabStatus(tabName, response.error, 'error')
      return
    }

    const jsonString = JSON.stringify(response.data, null, 2)
    await navigator.clipboard.writeText(jsonString)

    showTabStatus(tabName, `${getDataTypeName(dataType)} data copied!`, 'success')
    setTimeout(() => hideTabStatus(tabName), 2000)
  } catch (error) {
    showTabStatus(tabName, 'Copy failed: ' + error.message, 'error')
  } finally {
    if (copyBtn) copyBtn.disabled = false
  }
}
