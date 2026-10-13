import { describe, expect, it } from 'vitest'
import {
  SOLOMONIS_PARTY_PAGE,
  canImportRun,
  canUpdateImportedRun,
  matchingRuns,
  reportBookPage,
  reportLogPage,
  runImportPlan,
  runSteps
} from './steps.js'

const steps = (hasReport: boolean, hasBook: boolean, hasDeck: boolean) =>
  runSteps({ reportId: '381099', hasReport, hasBook, hasDeck })

describe('runSteps', () => {
  it('lists the expedition log, guidebook log and party deck in order', () => {
    expect(steps(false, false, false)).toEqual([
      {
        key: 'report',
        need: 'required',
        captured: false,
        page: '#arcarum3/dungeon_report_detail/id=381099'
      },
      {
        key: 'book',
        need: 'recommended',
        captured: false,
        page: '#arcarum3/dungeon_report_book/id=381099'
      },
      {
        key: 'deck',
        need: 'optional',
        captured: false,
        page: SOLOMONIS_PARTY_PAGE
      }
    ])
  })

  it('marks what was captured', () => {
    expect(steps(true, false, true).map((step) => step.captured)).toEqual([
      true,
      false,
      true
    ])
  })

  it('has no page for the party deck until its screen is known', () => {
    // Flip this when SOLOMONIS_PARTY_PAGE is filled in.
    expect(steps(true, true, false)[2]!.page).toBeNull()
  })

  it('builds report pages from the path ID only', () => {
    expect(reportLogPage('42')).toBe('#arcarum3/dungeon_report_detail/id=42')
    expect(reportBookPage('42')).toBe('#arcarum3/dungeon_report_book/id=42')
  })
})

describe('runImportPlan', () => {
  it('imports with everything captured', () => {
    expect(runImportPlan(steps(true, true, true))).toEqual({
      canImport: true,
      blocking: [],
      without: []
    })
  })

  it('needs the expedition log', () => {
    expect(runImportPlan(steps(false, true, true))).toEqual({
      canImport: false,
      blocking: ['report'],
      without: []
    })
  })

  it('imports without the guidebook log or party deck, and says so', () => {
    expect(runImportPlan(steps(true, false, false))).toEqual({
      canImport: true,
      blocking: [],
      without: ['book', 'deck']
    })
  })
})

describe('canUpdateImportedRun', () => {
  it('needs the guidebook log so an update never clears the guidebook', () => {
    expect(canUpdateImportedRun(true)).toBe(true)
    expect(canUpdateImportedRun(false)).toBe(false)
  })
})

describe('matchingRuns', () => {
  it("lists a deck's reports by Evoker, newest first", () => {
    const runs = [
      { dataType: 'solomonis_run_1', evokerId: '3040169000', lastUpdated: 10 },
      { dataType: 'solomonis_run_2', evokerId: '3040161000', lastUpdated: 30 },
      { dataType: 'solomonis_run_3', evokerId: '3040169000', lastUpdated: 20 },
      { dataType: 'solomonis_run_4', lastUpdated: 40 }
    ]
    expect(matchingRuns(runs, '3040169000').map((run) => run.dataType)).toEqual(
      ['solomonis_run_3', 'solomonis_run_1']
    )
    expect(matchingRuns(runs, null)).toEqual([])
  })
})

describe('canImportRun', () => {
  it('needs only the expedition log', () => {
    const run = { reportId: '1', report: {}, statusList: null }
    expect(canImportRun(run)).toBe(true)
    expect(canImportRun({ ...run, report: null, statusList: [] })).toBe(false)
    expect(canImportRun(null)).toBe(false)
  })
})
