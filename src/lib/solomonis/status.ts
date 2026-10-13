import * as m from '../../paraglide/messages.js'
import { BUCKET, getImageUrl } from '../constants.js'
import type { CacheStatusInfo } from '../types/cache.js'
import { runReadiness } from './report.js'

/** The side panel row's subtitle: ready, or which screen to open next. */
export function solomonisRunSubtitle(
  info: Pick<CacheStatusInfo, 'hasReport' | 'hasBook'>
): string {
  const readiness = runReadiness({
    report: info.hasReport ? {} : null,
    statusList: info.hasBook ? [] : null
  })
  switch (readiness) {
    case 'ready':
      return m.solomonis_extension_subtitle_ready()
    case 'needs_report':
      return m.solomonis_extension_subtitle_needs_report()
    default:
      // A cached entry always has at least one log; the expedition log
      // comes first in the game, so the guidebook log is what's left.
      return m.solomonis_extension_subtitle_needs_book()
  }
}

/** An Evoker's square portrait, for the side panel's deck rows. */
export function evokerPortraitUrl(evokerId: string | null | undefined): string {
  return evokerId
    ? getImageUrl(`${BUCKET.characterSquare}/${evokerId}_01.jpg`)
    : ''
}
