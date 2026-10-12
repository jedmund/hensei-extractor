import { describe, expect, it } from 'vitest'
import * as m from '../../paraglide/messages.js'
import { detailViewKind } from '../detail-data.js'
import { isSolomonisRunDataType } from './routes.js'
import { solomonisRunSubtitle } from './status.js'

describe('Solomonis run rows', () => {
  it('say whether a report is ready or which screen to open', () => {
    expect(solomonisRunSubtitle({ hasReport: true, hasBook: true })).toBe(
      m.solomonis_extension_subtitle_ready()
    )
    expect(solomonisRunSubtitle({ hasReport: true, hasBook: false })).toBe(
      m.solomonis_extension_subtitle_needs_book()
    )
    expect(solomonisRunSubtitle({ hasReport: false, hasBook: true })).toBe(
      m.solomonis_extension_subtitle_needs_report()
    )
  })

  it('open in the Solomonis run view', () => {
    expect(isSolomonisRunDataType('solomonis_run_381099')).toBe(true)
    expect(isSolomonisRunDataType('solomonis_run_')).toBe(false)
    expect(isSolomonisRunDataType('solomonis_report')).toBe(false)
    expect(detailViewKind('solomonis_run_381099')).toBe('solomonisRun')
    expect(detailViewKind('party_1_2')).toBe('party')
  })
})
