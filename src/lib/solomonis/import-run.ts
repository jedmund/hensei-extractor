/**
 * Side panel side of Solomonis imports: sends the open report or deck to
 * the background worker with the party meta the user set, then opens the
 * party. For a report, it also sends the deck picked as its current setup,
 * or asks whether to update the party the report was already imported as.
 */

import * as m from '../../paraglide/messages.js'
import { translateError } from '../i18n.js'
import {
  uploadSolomonisParty,
  uploadSolomonisRun
} from '../services/chrome-messages.js'
import { app } from '../state/app.svelte.js'
import type {
  UploadSolomonisPartyResponse,
  UploadSolomonisRunResponse
} from './upload.js'

export function solomonisImportErrorMessage(error: string): string {
  switch (error) {
    case 'not_logged_in':
    case 'invalid_token':
      return m.toast_import_failed_session()
    case 'request_failed':
      return m.toast_import_failed_network()
    case 'invalid_data':
      return m.toast_import_failed_invalid()
    case 'solomonis_report_incomplete':
      return m.solomonis_extension_toast_incomplete()
    default:
      return translateError(error)
  }
}

/** The toast for a finished import. */
export function solomonisImportToast(
  response: UploadSolomonisRunResponse | UploadSolomonisPartyResponse
): string {
  const warnings = response.warnings?.length ?? 0
  if ('updated' in response && response.updated) {
    return warnings > 0
      ? m.solomonis_extension_toast_updated_with_warnings({ count: warnings })
      : m.solomonis_extension_toast_updated()
  }
  if (response.shareFailed) return m.toast_opening_party_share_failed()
  return warnings > 0
    ? m.toast_opening_party_with_warnings({ count: warnings })
    : m.toast_opening_party()
}

/** Imports the open report. `updateExisting` answers a duplicate prompt. */
export async function importSolomonisRun(
  updateExisting = false
): Promise<void> {
  const dataType = app.currentDetailDataType
  if (!dataType) return
  app.importState = 'importing'

  try {
    const response = await uploadSolomonisRun({
      dataType,
      name: app.partyName?.trim() || undefined,
      visibility: app.selectedVisibility,
      shareWithCrew: app.shareWithCrew,
      playlists: app.selectedPlaylists,
      updateExisting,
      currentSetupDataType: app.solomonisSetupDataType ?? undefined
    })
    // The user went back or opened something else while it ran.
    if (app.currentDetailDataType !== dataType) return

    if (response.error === 'duplicate_report' && response.duplicate) {
      app.solomonisDuplicate = response.duplicate
      app.importState = 'idle'
    } else if (response.error || !response.url) {
      app.showToast(solomonisImportErrorMessage(response.error ?? 'unknown'))
      app.importState = 'idle'
    } else {
      chrome.tabs.create({ url: response.url })
      app.showToast(solomonisImportToast(response))
      app.importState = 'imported'
    }
  } catch {
    app.showToast(m.toast_import_failed())
    app.importState = 'idle'
  }
}

/** Imports the open deck as a new Solomonis party. */
export async function importSolomonisParty(): Promise<void> {
  const dataType = app.currentDetailDataType
  if (!dataType) return
  app.importState = 'importing'

  try {
    const response = await uploadSolomonisParty({
      dataType,
      name: app.partyName?.trim() || undefined,
      visibility: app.selectedVisibility,
      shareWithCrew: app.shareWithCrew,
      playlists: app.selectedPlaylists
    })
    // The user went back or opened something else while it ran.
    if (app.currentDetailDataType !== dataType) return

    if (response.error || !response.url) {
      app.showToast(solomonisImportErrorMessage(response.error ?? 'unknown'))
      app.importState = 'idle'
    } else {
      chrome.tabs.create({ url: response.url })
      app.showToast(solomonisImportToast(response))
      app.importState = 'imported'
    }
  } catch {
    app.showToast(m.toast_import_failed())
    app.importState = 'idle'
  }
}
