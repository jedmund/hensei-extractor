import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedPost } from './api-client.js'
import { cacheSupportSummons, uploadSupportSummons } from './support-summons.js'

vi.mock('./api-client.js', () => ({ authenticatedPost: vi.fn() }))

const URL = 'https://game.granbluefantasy.jp/profile/content/index/12345678'
const set = vi.fn(async () => undefined)

function envelope(html: string) {
  return { data: encodeURIComponent(html) }
}

beforeEach(() => {
  vi.stubGlobal('chrome', { storage: { local: { set } } })
})

describe('cacheSupportSummons', () => {
  it('caches the parsed slots from the player’s own profile', async () => {
    const html =
      '<div id="js-fix-summon10" data-masterid="2040094000"></div>' +
      '<div id="js-fix-summon10-name">Lvl 250 Agni</div>'

    await expect(cacheSupportSummons(envelope(html), 100, URL)).resolves.toBe(
      true
    )
    expect(set).toHaveBeenCalledWith({
      gbf_cache_support_summons: expect.objectContaining({
        timestamp: 100,
        totalItems: 1,
        gbfUserId: '12345678'
      })
    })
  })

  it('ignores another player’s profile so it can’t replace the user’s own', async () => {
    const html = '<div class="prt-summon" data-masterid="2040094000"></div>'

    await expect(cacheSupportSummons(envelope(html), 100, URL)).resolves.toBe(
      false
    )
    expect(set).not.toHaveBeenCalled()
  })
})

describe('uploadSupportSummons', () => {
  const parsed = {
    gbf_user_id: '12345678',
    is_own_profile: true,
    items: [
      {
        gbf_section: 1,
        position: 0,
        granblue_id: '2040094000',
        level: 250,
        name: 'Agni'
      },
      {
        gbf_section: 0,
        position: 0,
        granblue_id: '2049999000',
        level: null,
        name: null
      }
    ]
  }

  it('sends slots without display-only fields and returns the created count', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({
      data: { meta: { created: 2 } }
    })

    await expect(uploadSupportSummons(parsed)).resolves.toEqual({
      success: true,
      created: 2
    })
    expect(authenticatedPost).toHaveBeenCalledWith('/support_summons/import', {
      support_summons: [
        { gbf_section: 1, position: 0, granblue_id: '2040094000', level: 250 },
        { gbf_section: 0, position: 0, granblue_id: '2049999000', level: null }
      ]
    })
  })

  it('names the summons the API does not know about', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({
      error: 'invalid_data',
      errors: [{ error: 'Summon not found', granblue_id: '2049999000' }]
    })

    await expect(uploadSupportSummons(parsed)).resolves.toEqual({
      error: 'unknown_summons',
      unknownSummons: ['2049999000']
    })
  })

  it('passes other errors through', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({ error: 'not_logged_in' })

    await expect(uploadSupportSummons(parsed)).resolves.toEqual({
      error: 'not_logged_in'
    })
  })
})
