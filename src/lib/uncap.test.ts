import { describe, expect, it } from 'vitest'
import { deriveSummonUncap, summonStars } from './uncap.js'

describe('deriveSummonUncap', () => {
  // Same table as hensei-api SupportSummonImportService.derive_uncap
  it.each([
    [40, 0, 0],
    [60, 1, 0],
    [80, 2, 0],
    [100, 3, 0],
    [150, 4, 0],
    [200, 5, 0],
    [201, 6, 1],
    [210, 6, 1],
    [220, 6, 2],
    [250, 6, 5]
  ])('level %i → uncap %i, transcendence %i', (level, uncap, step) => {
    expect(deriveSummonUncap(level)).toEqual({
      uncapLevel: uncap,
      transcendenceStep: step
    })
  })
})

describe('summonStars', () => {
  it('shows unearned base stars as empty', () => {
    expect(summonStars(deriveSummonUncap(60))).toEqual([
      'filled',
      'empty',
      'empty'
    ])
  })

  it('adds FLB, ULB and transcendence stars as they are earned', () => {
    expect(summonStars(deriveSummonUncap(100))).toEqual([
      'filled',
      'filled',
      'filled'
    ])
    expect(summonStars(deriveSummonUncap(150))).toEqual([
      'filled',
      'filled',
      'filled',
      'flb'
    ])
    expect(summonStars(deriveSummonUncap(250))).toEqual([
      'filled',
      'filled',
      'filled',
      'flb',
      'flb',
      'transcendence stage5'
    ])
  })

  // One shard per 10 levels past 200
  it.each([
    [201, 1],
    [210, 1],
    [211, 2],
    [220, 2],
    [230, 3],
    [240, 4],
    [241, 5],
    [250, 5]
  ])('level %i shows a transcendence star with %i shards', (level, shards) => {
    expect(summonStars(deriveSummonUncap(level)).at(-1)).toBe(
      `transcendence stage${shards}`
    )
  })
})
