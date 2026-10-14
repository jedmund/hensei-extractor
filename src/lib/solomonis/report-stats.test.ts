import { describe, expect, it } from 'vitest'
import response from './__fixtures__/report-detail.json'
import {
  reportAllies,
  reportEconomy,
  reportEndedAt,
  reportSpaceStats,
  reportTurns
} from './report-stats.js'
import type { SolomonisReport } from './types.js'

const option = response.option as SolomonisReport

describe('reportSpaceStats', () => {
  it('reads every space count in display order', () => {
    expect(reportSpaceStats(option)).toEqual([
      { key: 'battle', count: 14 },
      { key: 'strong', count: 0 },
      { key: 'terrifying', count: 0 },
      { key: 'ruler', count: 0 },
      { key: 'boss', count: 2 },
      { key: 'event', count: 20 },
      { key: 'healing', count: 6 },
      { key: 'chest', count: 5 },
      { key: 'teleporter', count: 0 },
      { key: 'special', count: 1 }
    ])
  })

  it('skips counts the report left out or that aren’t counts', () => {
    expect(
      reportSpaceStats({ boss_count: '2', warp_count: 'x', incident_count: '' })
    ).toEqual([{ key: 'boss', count: 2 }])
  })
})

describe('reportEconomy', () => {
  it('reads shop purchases and Sephira coins', () => {
    expect(reportEconomy(option)).toEqual({
      shopPurchases: 18,
      pointsEarned: 2924
    })
  })

  it('is null for missing values', () => {
    expect(reportEconomy({})).toEqual({
      shopPurchases: null,
      pointsEarned: null
    })
  })
})

describe('reportAllies', () => {
  it('lists the five allies at the end', () => {
    expect(reportAllies(option)).toEqual([
      '3040265000_02',
      '3040554000_02',
      '3040639000_02',
      '3040610000_02_0',
      '3040169000_04'
    ])
  })

  it('skips empty slots', () => {
    expect(
      reportAllies({ npc1_image_id: '3040169000_04', npc2_image_id: null })
    ).toEqual(['3040169000_04'])
  })
})

describe('reportEndedAt', () => {
  it('marks the game time as JST', () => {
    expect(reportEndedAt(option)).toBe('10/11 16:38 JST')
  })

  it('is null without an end time', () => {
    expect(reportEndedAt({ ended_at: '' })).toBeNull()
    expect(reportEndedAt({})).toBeNull()
  })
})

describe('reportTurns', () => {
  it('reads the turn count', () => {
    expect(reportTurns(option)).toBe(109)
    expect(reportTurns({})).toBeNull()
  })
})
