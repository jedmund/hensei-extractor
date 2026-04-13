/**
 * Cache utility functions for the Granblue Fantasy Chrome extension.
 * Provides helper functions for formatting cache status and managing cache data.
 */

import * as m from '../paraglide/messages.js'
import { CACHE_TTL_MS, getDataTypeName } from './constants.js'
import type { CacheStatusInfo, FormattedCacheStatus } from './types/cache.js'

export function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return m.time_seconds_ago({ count: seconds })

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return m.time_minutes_ago({ count: minutes })

  const hours = Math.floor(minutes / 60)
  return m.time_hours_ago({ count: hours })
}

export function isStale(timestamp: number): boolean {
  return Date.now() - timestamp > CACHE_TTL_MS
}

export function formatCacheStatus(
  status: Record<string, CacheStatusInfo>
): Record<string, FormattedCacheStatus> {
  const formatted: Record<string, FormattedCacheStatus> = {}

  for (const [type, info] of Object.entries(status)) {
    const stashDisplayName =
      type.startsWith('stash_') && info.stashName
        ? info.stashName
        : getDataTypeName(type)

    if (!info.available) {
      formatted[type] = {
        ...info,
        displayName: stashDisplayName,
        subtitle: null,
        ageText: m.cache_no_data(),
        statusClass: 'unavailable'
      }
    } else if (info.isStale) {
      formatted[type] = {
        ...info,
        displayName: stashDisplayName,
        subtitle: null,
        ageText: m.cache_stale(),
        statusClass: 'stale'
      }
    } else {
      const ageText = formatAge(info.age)
      let subtitle: string | null = null
      let displayName = stashDisplayName

      if (
        type.startsWith('list_') ||
        type.startsWith('collection_') ||
        type.startsWith('stash_')
      ) {
        subtitle = m.count_items_pages({
          items: info.totalItems ?? 0,
          pages: info.pageCount ?? 0
        })
      }

      if (type.startsWith('detail_npc_')) {
        displayName = info.itemName ?? m.type_character()
      } else if (type.startsWith('detail_weapon_')) {
        displayName = info.itemName ?? m.type_weapon()
      } else if (type.startsWith('detail_summon_')) {
        displayName = info.itemName ?? m.type_summon()
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
