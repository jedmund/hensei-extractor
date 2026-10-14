import * as m from '../../paraglide/messages.js'
import { BUCKET, getImageUrl } from '../constants.js'
import type { CacheStatusInfo } from '../types/cache.js'
import { runReadiness } from './report.js'

/**
 * The side panel row's subtitle: "Expedition", or that the expedition log
 * is still needed (a run can't be imported without it).
 */
export function solomonisRunSubtitle(
  info: Pick<CacheStatusInfo, 'hasReport' | 'hasBook'>
): string {
  const readiness = runReadiness({
    report: info.hasReport ? {} : null,
    statusList: info.hasBook ? [] : null
  })
  return readiness === 'needs_report'
    ? m.solomonis_extension_subtitle_needs_report()
    : m.solomonis_extension_subtitle_expedition()
}

/** An Evoker's square portrait, for the side panel's deck rows. */
export function evokerPortraitUrl(evokerId: string | null | undefined): string {
  return evokerId
    ? getImageUrl(`${BUCKET.characterSquare}/${evokerId}_01.jpg`)
    : ''
}
