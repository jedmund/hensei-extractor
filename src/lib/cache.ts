/**
 * Cache utility functions for the Granblue Fantasy Chrome extension.
 * Provides helper functions for formatting cache status and managing cache data.
 */

import * as m from '../paraglide/messages.js'
import {
  CACHE_TTL_MS,
  getDataTypeName,
  SUPPORT_SUMMON_SLOTS
} from './constants.js'
import type { CacheStatusInfo, FormattedCacheStatus } from './types/cache.js'
import { solomonisRunSubtitle } from './solomonis/status.js'

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

/**
 * A database character's name for its captured style: a later style shows
 * its own name from the payload (e.g. "Super Cidala"), or the character's
 * name marked as a style shift when the payload doesn't name it.
 */
export function npcDetailDisplayName(
  name: string,
  style: number | undefined,
  styleName: string | undefined
): string {
  if (!style || style <= 1) return name
  return styleName || m.detail_style_shift_name({ name })
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
      } else if (type.startsWith('solomonis_run_')) {
        subtitle = solomonisRunSubtitle(info)
      } else if (type.startsWith('solomonis_deck_')) {
        subtitle = m.solomonis_extension_deck_title()
      } else if (type === 'support_summons') {
        subtitle = m.support_summons_subtitle({
          set: info.totalItems ?? 0,
          total: SUPPORT_SUMMON_SLOTS
        })
      }

      if (type.startsWith('unf_scores_')) {
        const eventNum = type.replace('unf_scores_', '')
        displayName = m.crew_event_label({ eventNumber: eventNum })
        const members = info.totalItems ?? 0
        subtitle = `${m.crew_total_score()}\u00A0\u00B7\u00A0${m.crew_member_count({ count: members })}`
      } else if (type.startsWith('unf_daily_scores_')) {
        const eventNum = type.replace('unf_daily_scores_', '')
        displayName = m.crew_event_label({ eventNumber: eventNum })
        const members = info.totalItems ?? 0
        subtitle = `${m.crew_daily_score()}\u00A0\u00B7\u00A0${m.crew_member_count({ count: members })}`
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
