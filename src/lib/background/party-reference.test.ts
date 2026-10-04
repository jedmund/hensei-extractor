import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../constants.js'
import {
  fetchJobSkillSlugs,
  fetchWeaponKeyMap,
  fetchWeaponStatModifiers,
  resetPartyReferenceCaches,
  searchSummonByName
} from './party-reference.js'

vi.mock('../constants.js', () => ({
  apiFetch: vi.fn(),
  getApiUrl: vi.fn(async (endpoint: string) => `https://api.test/v1${endpoint}`)
}))

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response
}

const failed = { ok: false, json: async () => ({}) } as Response

beforeEach(() => {
  resetPartyReferenceCaches()
})

describe('searchSummonByName', () => {
  it('posts the name and returns the exact English or Japanese match', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      ok({
        results: [
          { granblue_id: '2040003000', name: { en: 'Bahamut Lv1' } },
          { granblue_id: '2040003001', name: { en: 'X', ja: 'バハムート' } }
        ]
      })
    )

    await expect(searchSummonByName('バハムート')).resolves.toEqual({
      granblue_id: '2040003001',
      name: { en: 'X', ja: 'バハムート' }
    })
    expect(apiFetch).toHaveBeenCalledWith(
      'https://api.test/v1/search/summons',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: { query: 'バハムート' } })
      }
    )
  })

  it('returns null without a match, on an error response, or when the request throws', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      ok({ results: [{ name: { en: 'Bahamut Lv1' } }] })
    )
    await expect(searchSummonByName('Bahamut')).resolves.toBeNull()

    vi.mocked(apiFetch).mockResolvedValueOnce(failed)
    await expect(searchSummonByName('Bahamut')).resolves.toBeNull()

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    await expect(searchSummonByName('Bahamut')).resolves.toBeNull()
  })

  it('skips the request for an empty name', async () => {
    await expect(searchSummonByName('')).resolves.toBeNull()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe('fetchWeaponKeyMap', () => {
  function mockKeyEndpoints() {
    vi.mocked(apiFetch).mockImplementation(async (url) =>
      String(url).endsWith('/skill_map')
        ? ok({ '1001': 'pendulum-strength', '1002': 'unknown-key' })
        : ok([
            {
              slug: 'pendulum-strength',
              name: { en: 'Pendulum of Strength', ja: '強壮のペンデュラム' }
            }
          ])
    )
  }

  it('maps skill ids to the key slug and its name in the locale', async () => {
    mockKeyEndpoints()

    await expect(fetchWeaponKeyMap('ja')).resolves.toEqual({
      '1001': { slug: 'pendulum-strength', name: '強壮のペンデュラム' },
      '1002': { slug: 'unknown-key', name: 'unknown-key' }
    })
    expect(apiFetch).toHaveBeenCalledWith(
      'https://api.test/v1/weapon_keys/skill_map'
    )
    expect(apiFetch).toHaveBeenCalledWith('https://api.test/v1/weapon_keys')
  })

  // Not keyed by locale: the first language asked keeps its names.
  it('reuses the first map it built', async () => {
    mockKeyEndpoints()

    const first = await fetchWeaponKeyMap('en')
    await expect(fetchWeaponKeyMap('ja')).resolves.toBe(first)
    expect(apiFetch).toHaveBeenCalledTimes(2)
  })

  it('returns null and caches nothing when either request fails', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(failed)
    await expect(fetchWeaponKeyMap('en')).resolves.toBeNull()

    mockKeyEndpoints()
    await expect(fetchWeaponKeyMap('en')).resolves.not.toBeNull()
  })
})

describe('fetchWeaponStatModifiers', () => {
  it('keys modifiers by slug and caches them', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      ok([
        {
          slug: 'ex_skill_atk',
          name_en: 'ATK',
          name_jp: '攻撃力',
          suffix: '%'
        },
        { slug: 'ex_skill_hp', name_en: 'HP', name_jp: 'HP' }
      ])
    )

    const modifiers = await fetchWeaponStatModifiers()
    expect(modifiers).toEqual({
      ex_skill_atk: { nameEn: 'ATK', nameJp: '攻撃力', suffix: '%' },
      ex_skill_hp: { nameEn: 'HP', nameJp: 'HP', suffix: '' }
    })
    await expect(fetchWeaponStatModifiers()).resolves.toBe(modifiers)
    expect(apiFetch).toHaveBeenCalledTimes(1)
    expect(apiFetch).toHaveBeenCalledWith(
      'https://api.test/v1/weapon_stat_modifiers'
    )
  })

  it('returns null on failure', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(failed)
    await expect(fetchWeaponStatModifiers()).resolves.toBeNull()

    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    await expect(fetchWeaponStatModifiers()).resolves.toBeNull()
  })
})

describe('fetchJobSkillSlugs', () => {
  it('resolves names, with null for unknown ones', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      ok([
        { name: 'Rage IV', slug: 'rage-iv' },
        { name: 'Mystery', slug: null }
      ])
    )

    await expect(
      fetchJobSkillSlugs(['Rage IV', 'Mystery', 'Missing'])
    ).resolves.toEqual({ 'Rage IV': 'rage-iv', Mystery: null, Missing: null })
    expect(apiFetch).toHaveBeenCalledWith(
      'https://api.test/v1/job_skills/resolve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: ['Rage IV', 'Mystery', 'Missing'] })
      }
    )
  })

  it('only requests names it has not resolved, including unknown ones', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      ok([
        { name: 'Rage IV', slug: 'rage-iv' },
        { name: 'Mystery', slug: null }
      ])
    )
    await fetchJobSkillSlugs(['Rage IV', 'Mystery'])

    await expect(fetchJobSkillSlugs(['Mystery', 'Rage IV'])).resolves.toEqual({
      Mystery: null,
      'Rage IV': 'rage-iv'
    })
    expect(apiFetch).toHaveBeenCalledTimes(1)

    vi.mocked(apiFetch).mockResolvedValueOnce(
      ok([{ name: 'Armor Break', slug: 'armor-break' }])
    )
    await fetchJobSkillSlugs(['Rage IV', 'Armor Break'])
    expect(apiFetch).toHaveBeenLastCalledWith(
      'https://api.test/v1/job_skills/resolve',
      expect.objectContaining({
        body: JSON.stringify({ names: ['Armor Break'] })
      })
    )
  })

  it('falls back to null for every unresolved name when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('offline'))
    await expect(fetchJobSkillSlugs(['Rage IV'])).resolves.toEqual({
      'Rage IV': null
    })

    // A failed request caches nothing, so the next call tries again.
    vi.mocked(apiFetch).mockResolvedValueOnce(
      ok([{ name: 'Rage IV', slug: 'rage-iv' }])
    )
    await expect(fetchJobSkillSlugs(['Rage IV'])).resolves.toEqual({
      'Rage IV': 'rage-iv'
    })
  })
})
