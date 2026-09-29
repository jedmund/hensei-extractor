/**
 * Uncap state from an in-game summon level.
 *
 * The profile page only shows a level, so this mirrors hensei-api's
 * SupportSummonImportService.derive_uncap: the same level gives the same
 * uncap here as the site stores on import.
 */
export interface SummonUncap {
  uncapLevel: number
  transcendenceStep: number
}

export function deriveSummonUncap(level: number): SummonUncap {
  if (level <= 40) return { uncapLevel: 0, transcendenceStep: 0 }
  if (level <= 60) return { uncapLevel: 1, transcendenceStep: 0 }
  if (level <= 80) return { uncapLevel: 2, transcendenceStep: 0 }
  if (level <= 100) return { uncapLevel: 3, transcendenceStep: 0 }
  if (level <= 150) return { uncapLevel: 4, transcendenceStep: 0 }
  if (level <= 200) return { uncapLevel: 5, transcendenceStep: 0 }
  // 201–250: transcended, one step per 10 levels
  const step = Math.min(5, Math.max(1, Math.ceil((level - 200) / 10)))
  return { uncapLevel: 6, transcendenceStep: step }
}

export type StarKind = 'empty' | 'filled' | 'flb' | 'ulb'

/**
 * Star row for a summon, using the side panel's .star classes: three base
 * stars (empty until earned), then a blue star each for FLB and ULB and a
 * purple one for transcendence. Stars the summon hasn't reached past the
 * base three are left off, since the page doesn't say which it can reach.
 */
export function summonStars({ uncapLevel }: SummonUncap): StarKind[] {
  const stars: StarKind[] = [0, 1, 2].map((i) =>
    uncapLevel > i ? 'filled' : 'empty'
  )
  if (uncapLevel >= 4) stars.push('flb')
  if (uncapLevel >= 5) stars.push('flb')
  if (uncapLevel >= 6) stars.push('ulb')
  return stars
}
