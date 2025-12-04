/**
 * @fileoverview Network response interceptor for Granblue Fantasy.
 * This script is injected into the page context (world: MAIN) to intercept
 * fetch and XMLHttpRequest responses. It captures the raw JSON responses
 * from GBF API endpoints without making any additional requests.
 *
 * SAFETY: This script only READS responses the game already receives.
 * It never makes additional requests or modifies game behavior.
 */

(function() {
  'use strict'

  // Endpoints we want to capture
  const INTERCEPT_PATTERNS = [
    '/party/deck',
    '/archive/npc_detail',
    '/archive/weapon_detail',
    '/archive/summon_detail',
    '/npc/list/',
    '/weapon/list/',
    '/summon/list/',
    // Collection pages (inventory)
    '/rest/weapon/list/',
    '/rest/npc/list/',
    '/rest/summon/list/',
    '/rest/artifact/list/'
  ]

  /**
   * Check if a URL matches any of our intercept patterns
   * @param {string} url - The URL to check
   * @returns {boolean}
   */
  function shouldIntercept(url) {
    if (!url) return false
    return INTERCEPT_PATTERNS.some(pattern => url.includes(pattern))
  }

  /**
   * Determine the data type from the URL
   * @param {string} url - The URL to analyze
   * @returns {string} The data type identifier
   */
  function getDataType(url) {
    if (url.includes('/party/deck')) return 'party'
    if (url.includes('/archive/npc_detail')) return 'detail_npc'
    if (url.includes('/archive/weapon_detail')) return 'detail_weapon'
    if (url.includes('/archive/summon_detail')) return 'detail_summon'
    // Collection pages (rest API endpoints)
    if (url.includes('/rest/weapon/list/')) return 'collection_weapon'
    if (url.includes('/rest/npc/list/')) return 'collection_npc'
    if (url.includes('/rest/summon/list/')) return 'collection_summon'
    if (url.includes('/rest/artifact/list/')) return 'collection_artifact'
    // Legacy list endpoints
    if (url.includes('/npc/list/')) return 'list_npc'
    if (url.includes('/weapon/list/')) return 'list_weapon'
    if (url.includes('/summon/list/')) return 'list_summon'
    return 'unknown'
  }

  /**
   * Extract page number from list URL
   * @param {string} url - The URL to analyze
   * @returns {number|null} The page number or null
   */
  function getPageNumber(url) {
    const match = url.match(/\/list\/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  /**
   * Dispatch intercepted data to the content script
   * @param {string} url - The request URL
   * @param {object} data - The JSON response data
   */
  function dispatchInterceptedData(url, data) {
    const dataType = getDataType(url)
    const pageNumber = getPageNumber(url)

    window.dispatchEvent(new CustomEvent('gbf-data-intercepted', {
      detail: {
        url: url,
        data: data,
        dataType: dataType,
        pageNumber: pageNumber,
        timestamp: Date.now()
      }
    }))
  }

  // ==========================================
  // FETCH INTERCEPTION
  // ==========================================

  const originalFetch = window.fetch

  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args)

    // Extract URL from arguments
    let url = ''
    if (typeof args[0] === 'string') {
      url = args[0]
    } else if (args[0] instanceof Request) {
      url = args[0].url
    } else if (args[0] && args[0].url) {
      url = args[0].url
    }

    // Only intercept matching endpoints
    if (shouldIntercept(url)) {
      // Clone response so we don't consume it
      const clone = response.clone()

      try {
        const json = await clone.json()
        dispatchInterceptedData(url, json)
      } catch (e) {
        // Response wasn't JSON, ignore
      }
    }

    return response
  }

  // ==========================================
  // XMLHTTPREQUEST INTERCEPTION
  // ==========================================

  const originalXHROpen = XMLHttpRequest.prototype.open
  const originalXHRSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    // Store the URL for later reference
    this._gbfInterceptUrl = url
    return originalXHROpen.apply(this, [method, url, ...rest])
  }

  XMLHttpRequest.prototype.send = function(...args) {
    const url = this._gbfInterceptUrl

    if (shouldIntercept(url)) {
      this.addEventListener('load', function() {
        try {
          const json = JSON.parse(this.responseText)
          dispatchInterceptedData(url, json)
        } catch (e) {
          // Response wasn't JSON, ignore
        }
      })
    }

    return originalXHRSend.apply(this, args)
  }

  // Signal that the interceptor is ready
  window.dispatchEvent(new CustomEvent('gbf-interceptor-ready'))
})()
