import { describe, expect, it } from 'vitest'
import detailResponse from './__fixtures__/report-detail.json'
import spacebookResponse from './__fixtures__/report-spacebook.json'
import {
  buildRunImportBody,
  emptyCapture,
  guidebookStackCount,
  mergeCapture,
  runReadiness,
  shapeReport,
  shapeStatusList
} from './report.js'
import type { SolomonisRunCapture } from './types.js'

function pairedCapture(): SolomonisRunCapture {
  return {
    reportId: '381099',
    report: shapeReport(detailResponse),
    statusList: shapeStatusList(spacebookResponse),
    reportCapturedAt: 1,
    bookCapturedAt: 2
  }
}

describe('shapeReport', () => {
  it('keeps option without langMsg, display_list or the HTML data', () => {
    const report = shapeReport(detailResponse)!
    expect(report).not.toHaveProperty('langMsg')
    expect(report).not.toHaveProperty('display_list')
    expect(report).not.toHaveProperty('data')
    const { langMsg: _langMsg, ...option } = detailResponse.option
    expect(report).toEqual(option)
  })

  it('accepts an already shaped report unchanged', () => {
    const report = shapeReport(detailResponse)!
    expect(shapeReport(report)).toEqual(report)
  })

  it('drops display_list even if it turns up inside option', () => {
    const report = shapeReport({
      option: { dungeon_report_id: 1, display_list: [{ user_id: '1' }] }
    })
    expect(report).toEqual({ dungeon_report_id: 1 })
  })

  it('returns null for responses without a report', () => {
    expect(shapeReport(null)).toBeNull()
    expect(shapeReport({ data: '' })).toBeNull()
    expect(shapeReport({ option: {} })).toBeNull()
    expect(shapeReport([])).toBeNull()
  })
})

describe('shapeStatusList', () => {
  it('keeps the status list unchanged', () => {
    expect(shapeStatusList(spacebookResponse)).toEqual(
      spacebookResponse.status_list
    )
  })

  it('returns null without a status list', () => {
    expect(shapeStatusList({})).toBeNull()
    expect(shapeStatusList({ status_list: {} })).toBeNull()
    expect(shapeStatusList(null)).toBeNull()
  })

  it('keeps an empty guidebook', () => {
    expect(shapeStatusList({ status_list: [] })).toEqual([])
  })
})

describe('pairing', () => {
  it('needs both logs before a report is ready', () => {
    const empty = emptyCapture('381099')
    expect(runReadiness(empty)).toBe('needs_both')
    expect(runReadiness(null)).toBe('needs_both')

    const withReport = mergeCapture(empty, {
      report: shapeReport(detailResponse)!,
      timestamp: 10
    })
    expect(runReadiness(withReport)).toBe('needs_book')
    expect(withReport.reportCapturedAt).toBe(10)

    const withBook = mergeCapture(empty, { statusList: [], timestamp: 20 })
    expect(runReadiness(withBook)).toBe('needs_report')

    const both = mergeCapture(withReport, { statusList: [], timestamp: 20 })
    expect(runReadiness(both)).toBe('ready')
    expect(both.report).toEqual(withReport.report)
    expect(both.bookCapturedAt).toBe(20)
  })

  it('replaces an earlier capture of the same log', () => {
    const first = mergeCapture(emptyCapture('1'), {
      statusList: [{ status_id: 1, num: 1 }],
      timestamp: 1
    })
    const second = mergeCapture(first, {
      statusList: [{ status_id: 2, num: 3 }],
      timestamp: 2
    })
    expect(second.statusList).toEqual([{ status_id: 2, num: 3 }])
  })

  it('counts guidebook stacks', () => {
    expect(guidebookStackCount(spacebookResponse.status_list)).toBe(7)
    expect(guidebookStackCount([{ num: 2 }, {}])).toBe(2)
  })
})

describe('buildRunImportBody', () => {
  it('builds the contract body', () => {
    const body = buildRunImportBody(pairedCapture(), {
      visibility: 1,
      playlistIds: []
    })
    const { langMsg: _langMsg, ...option } = detailResponse.option
    expect(body).toEqual({
      kind: 'solomonis_run',
      visibility: 1,
      playlist_ids: [],
      solomonis: {
        report_id: 381099,
        report: option,
        status_list: spacebookResponse.status_list
      },
      update_existing: false
    })
  })

  it('never sends langMsg, display_list, the HTML data or the query string', () => {
    // Even if the cache held the raw response, the body is shaped again.
    const capture = {
      ...pairedCapture(),
      report: detailResponse as unknown as SolomonisRunCapture['report']
    }
    const json = JSON.stringify(buildRunImportBody(capture))
    expect(json).not.toContain('langMsg')
    expect(json).not.toContain('display_list')
    expect(json).not.toContain('user_id')
    expect(json).not.toContain('root')
    expect(json).not.toMatch(/uid=|"uid"/)
    expect(json).not.toContain('"data"')
  })

  it('sends a trimmed name, playlists and update_existing when asked', () => {
    const body = buildRunImportBody(pairedCapture(), {
      name: '  Nier clear  ',
      playlistIds: ['p1'],
      updateExisting: true
    })!
    expect(body.name).toBe('Nier clear')
    expect(body.playlist_ids).toEqual(['p1'])
    expect(body.update_existing).toBe(true)
    expect(body).not.toHaveProperty('visibility')
  })

  it('leaves out a blank name and a missing current setup', () => {
    const body = buildRunImportBody(pairedCapture(), {
      name: '   ',
      currentSetup: null
    })!
    expect(body).not.toHaveProperty('name')
    expect(body.solomonis).not.toHaveProperty('current_setup')
  })

  it('passes a current setup through when there is one', () => {
    const setup = { deck: { name: 'Nier' } }
    const body = buildRunImportBody(pairedCapture(), { currentSetup: setup })!
    expect(body.solomonis.current_setup).toEqual(setup)
  })

  it('returns null until both logs are captured', () => {
    expect(
      buildRunImportBody({ ...pairedCapture(), statusList: null })
    ).toBeNull()
    expect(buildRunImportBody({ ...pairedCapture(), report: null })).toBeNull()
    expect(
      buildRunImportBody({ ...pairedCapture(), reportId: 'abc' })
    ).toBeNull()
  })
})
