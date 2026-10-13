/**
 * Uploads Evoking Solomonis captures to POST /import:
 *
 * - an expedition report, `kind: "solomonis_run"`. A report this user
 *   already imported comes back as 409 `duplicate_report`, which the side
 *   panel offers to resend with `update_existing: true`.
 * - an Evoker's party deck, `kind: "solomonis_party"`: a new party each time.
 */

import { apiFetch, getApiUrl, getSiteBaseUrl } from '../constants.js'
import {
  authenticatedPost,
  getAuthToken,
  parseErrorBody
} from '../background/api-client.js'
import { buildPartyImportBody } from './deck.js'
import { buildRunImportBody } from './report.js'
import type {
  SolomonisPartyImportOptions,
  SolomonisRunCapture,
  SolomonisRunImportOptions
} from './types.js'

export interface UploadSolomonisRunResponse {
  success?: boolean
  shortcode?: string
  url?: string
  warnings?: string[]
  /** The party was imported but sharing it with the crew failed */
  shareFailed?: boolean
  /** True when an existing party was updated instead of a new one created */
  updated?: boolean
  error?: string
  /** With `duplicate_report`: the party this report was already imported as */
  duplicate?: { partyId: string | null; shortcode: string; url: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Reads a 409 body; null unless it's the contract's duplicate_report. */
async function parseDuplicate(
  response: Response
): Promise<{ partyId: string | null; shortcode: string } | null> {
  try {
    const body: unknown = await response.json()
    if (!isRecord(body) || body.error !== 'duplicate_report') return null
    if (typeof body.shortcode !== 'string' || !body.shortcode) return null
    return {
      partyId: typeof body.party_id === 'string' ? body.party_id : null,
      shortcode: body.shortcode
    }
  } catch {
    return null
  }
}

export async function uploadSolomonisRun(
  capture: SolomonisRunCapture,
  options: SolomonisRunImportOptions = {}
): Promise<UploadSolomonisRunResponse> {
  const body = buildRunImportBody(capture, options)
  if (!body) return { error: 'solomonis_report_incomplete' }

  const auth = await getAuthToken()
  if (!auth) return { error: 'not_logged_in' }

  let response: Response
  try {
    response = await apiFetch(await getApiUrl('/import'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.access_token}`
      },
      body: JSON.stringify(body)
    })
  } catch {
    return { error: 'request_failed' }
  }

  const siteUrl = await getSiteBaseUrl()
  const partyUrl = (shortcode: string) => `${siteUrl}/teams/${shortcode}`

  if (response.status === 409) {
    // The generic error parser keeps neither the code nor the existing run,
    // so the conflict body is read here.
    const duplicate = await parseDuplicate(response.clone())
    if (duplicate) {
      return {
        error: 'duplicate_report',
        duplicate: { ...duplicate, url: partyUrl(duplicate.shortcode) }
      }
    }
  }
  if (!response.ok) {
    return { error: (await parseErrorBody(response)).error }
  }

  let data: Record<string, unknown>
  try {
    const json: unknown = await response.json()
    data = isRecord(json) ? json : {}
  } catch {
    data = {}
  }
  const shortcode = typeof data.shortcode === 'string' ? data.shortcode : null
  if (!shortcode) return { error: 'invalid_data' }

  // The party is already saved, so a failed share doesn't fail the import.
  // An updated party keeps the sharing it already had.
  let shareFailed = false
  if (
    options.shareWithCrew &&
    !body.update_existing &&
    typeof data.party_id === 'string'
  ) {
    const share = await authenticatedPost(
      `/parties/${data.party_id}/shares`,
      {}
    )
    shareFailed = !!share.error
  }

  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((w): w is string => typeof w === 'string')
    : []

  return {
    success: true,
    shortcode,
    url: partyUrl(shortcode),
    warnings,
    ...(body.update_existing && { updated: true }),
    ...(shareFailed && { shareFailed })
  }
}

export type UploadSolomonisPartyResponse = Omit<
  UploadSolomonisRunResponse,
  'updated' | 'duplicate'
>

/** Imports a captured deck as a new Solomonis party. */
export async function uploadSolomonisParty(
  deck: unknown,
  options: SolomonisPartyImportOptions = {}
): Promise<UploadSolomonisPartyResponse> {
  const body = buildPartyImportBody(deck, options)
  if (!body) return { error: 'invalid_data' }

  const result = await authenticatedPost('/import', body)
  if (result.error) return { error: result.error }

  const data = result.data ?? {}
  const shortcode = typeof data.shortcode === 'string' ? data.shortcode : null
  if (!shortcode) return { error: 'invalid_data' }

  // The party is already saved, so a failed share doesn't fail the import.
  let shareFailed = false
  if (options.shareWithCrew && typeof data.party_id === 'string') {
    const share = await authenticatedPost(
      `/parties/${data.party_id}/shares`,
      {}
    )
    shareFailed = !!share.error
  }

  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((w): w is string => typeof w === 'string')
    : []

  return {
    success: true,
    shortcode,
    url: `${await getSiteBaseUrl()}/teams/${shortcode}`,
    warnings,
    ...(shareFailed && { shareFailed })
  }
}
