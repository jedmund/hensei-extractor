import { beforeEach, describe, expect, it, vi } from 'vitest'
import detailResponse from './__fixtures__/report-detail.json'
import spacebookResponse from './__fixtures__/report-spacebook.json'
import deckResponse from './__fixtures__/party-deck.json'
import { apiFetch } from '../constants.js'
import { authenticatedPost, getAuthToken } from '../background/api-client.js'
import { shapeReport, shapeStatusList } from './report.js'
import type { SolomonisRunCapture } from './types.js'
import { uploadSolomonisParty, uploadSolomonisRun } from './upload.js'

vi.mock('../constants.js', () => ({
  apiFetch: vi.fn(),
  getApiUrl: async (path: string) => `https://api.test/v1${path}`,
  getSiteBaseUrl: async () => 'https://granblue.team'
}))
vi.mock('../background/api-client.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../background/api-client.js')>()),
  authenticatedPost: vi.fn(async () => ({ data: {} })),
  getAuthToken: vi.fn()
}))

const response = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })

const capture: SolomonisRunCapture = {
  reportId: '381099',
  report: shapeReport(detailResponse),
  statusList: shapeStatusList(spacebookResponse),
  reportCapturedAt: 1,
  bookCapturedAt: 2
}

function sentBody(call = 0): Record<string, unknown> {
  const init = vi.mocked(apiFetch).mock.calls[call]![1]!
  return JSON.parse(init.body as string) as Record<string, unknown>
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset()
  vi.mocked(authenticatedPost).mockClear()
  vi.mocked(getAuthToken).mockResolvedValue({
    access_token: 'token',
    user: { id: 'u', username: 'test' }
  })
})

describe('uploadSolomonisRun', () => {
  it('posts the run to /import and returns the new party', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      response(201, {
        party_id: 'party-1',
        shortcode: 'run001',
        warnings: [
          'spacebook_status_count is 71 but the guidebook holds 7 stacks'
        ]
      })
    )

    const result = await uploadSolomonisRun(capture, { visibility: 1 })

    expect(vi.mocked(apiFetch).mock.calls[0]![0]).toBe(
      'https://api.test/v1/import'
    )
    expect(vi.mocked(apiFetch).mock.calls[0]![1]!.method).toBe('POST')
    const body = sentBody()
    expect(body.kind).toBe('solomonis_run')
    expect(body.update_existing).toBe(false)
    expect(JSON.stringify(body)).not.toMatch(/langMsg|display_list|uid=|"uid"/)
    expect(result).toEqual({
      success: true,
      shortcode: 'run001',
      url: 'https://granblue.team/teams/run001',
      warnings: [
        'spacebook_status_count is 71 but the guidebook holds 7 stacks'
      ]
    })
  })

  it('reports a duplicate with the existing run', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      response(409, {
        error: 'duplicate_report',
        party_id: 'party-1',
        shortcode: 'run001'
      })
    )

    expect(await uploadSolomonisRun(capture)).toEqual({
      error: 'duplicate_report',
      duplicate: {
        partyId: 'party-1',
        shortcode: 'run001',
        url: 'https://granblue.team/teams/run001'
      }
    })
  })

  it('resends with update_existing to update the existing run', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      response(201, { party_id: 'party-1', shortcode: 'run001', warnings: [] })
    )

    const result = await uploadSolomonisRun(capture, {
      updateExisting: true,
      shareWithCrew: true
    })

    expect(sentBody().update_existing).toBe(true)
    expect(result).toMatchObject({ success: true, updated: true })
    // An updated run keeps the sharing it already had.
    expect(authenticatedPost).not.toHaveBeenCalled()
  })

  it('treats any other 409 as a plain conflict', async () => {
    vi.mocked(apiFetch).mockResolvedValue(response(409, { error: 'other' }))
    expect(await uploadSolomonisRun(capture)).toEqual({ error: 'conflict' })
  })

  it('maps other API errors through the shared parser', async () => {
    vi.mocked(apiFetch).mockResolvedValue(response(422, { error: 'x' }))
    expect(await uploadSolomonisRun(capture)).toEqual({ error: 'invalid_data' })
    vi.mocked(apiFetch).mockResolvedValue(response(500, {}))
    expect(await uploadSolomonisRun(capture)).toEqual({
      error: 'server_error'
    })
    vi.mocked(apiFetch).mockRejectedValue(new TypeError('offline'))
    expect(await uploadSolomonisRun(capture)).toEqual({
      error: 'request_failed'
    })
  })

  it('shares a new run with the crew when asked', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      response(201, { party_id: 'party-1', shortcode: 'run001' })
    )
    vi.mocked(authenticatedPost).mockResolvedValue({ error: 'forbidden' })

    const result = await uploadSolomonisRun(capture, { shareWithCrew: true })

    expect(authenticatedPost).toHaveBeenCalledWith(
      '/parties/party-1/shares',
      {}
    )
    expect(result).toMatchObject({ success: true, shareFailed: true })
  })

  it('encodes the party id in the share path', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      response(201, { party_id: 'a/b?c#d e', shortcode: 'run001' })
    )

    await uploadSolomonisRun(capture, { shareWithCrew: true })

    expect(authenticatedPost).toHaveBeenCalledWith(
      '/parties/a%2Fb%3Fc%23d%20e/shares',
      {}
    )
  })

  it('needs the expedition log and a login before posting', async () => {
    expect(await uploadSolomonisRun({ ...capture, report: null })).toEqual({
      error: 'solomonis_report_incomplete'
    })
    expect(
      await uploadSolomonisRun(
        { ...capture, statusList: null },
        { updateExisting: true }
      )
    ).toEqual({ error: 'solomonis_report_incomplete' })

    vi.mocked(getAuthToken).mockResolvedValue(null)
    expect(await uploadSolomonisRun(capture)).toEqual({
      error: 'not_logged_in'
    })
    expect(apiFetch).not.toHaveBeenCalled()
  })
})

describe('uploadSolomonisParty', () => {
  const posted = () =>
    vi.mocked(authenticatedPost).mock.calls[0] as unknown as [
      string,
      Record<string, unknown>
    ]

  it('posts the deck to /import as a new party', async () => {
    vi.mocked(authenticatedPost).mockResolvedValueOnce({
      data: { party_id: 'party-1', shortcode: 'abc123', warnings: ['w', 1] }
    })

    const result = await uploadSolomonisParty(deckResponse, {
      name: 'Fraux',
      visibility: 2,
      playlistIds: ['7']
    })

    const [endpoint, body] = posted()
    expect(endpoint).toBe('/import')
    expect(body).toMatchObject({
      kind: 'solomonis_party',
      name: 'Fraux',
      visibility: 2,
      playlist_ids: ['7']
    })
    expect(JSON.stringify(body)).not.toContain('12345678')
    expect(result).toEqual({
      success: true,
      shortcode: 'abc123',
      url: 'https://granblue.team/teams/abc123',
      warnings: ['w']
    })
  })

  it('passes API errors on', async () => {
    vi.mocked(authenticatedPost).mockResolvedValueOnce({
      error: 'invalid_token'
    })
    expect(await uploadSolomonisParty(deckResponse)).toEqual({
      error: 'invalid_token'
    })
    vi.mocked(authenticatedPost).mockResolvedValueOnce({
      error: 'invalid_data'
    })
    expect(await uploadSolomonisParty(deckResponse)).toEqual({
      error: 'invalid_data'
    })
  })

  it('shares the new party with the crew when asked', async () => {
    vi.mocked(authenticatedPost)
      .mockResolvedValueOnce({ data: { party_id: 'party-1', shortcode: 'a' } })
      .mockResolvedValueOnce({ error: 'forbidden' })

    const result = await uploadSolomonisParty(deckResponse, {
      shareWithCrew: true
    })

    expect(authenticatedPost).toHaveBeenLastCalledWith(
      '/parties/party-1/shares',
      {}
    )
    expect(result).toMatchObject({ success: true, shareFailed: true })
  })

  it('encodes the party id in the share path', async () => {
    vi.mocked(authenticatedPost)
      .mockResolvedValueOnce({
        data: { party_id: 'a/b?c#d e', shortcode: 'a' }
      })
      .mockResolvedValueOnce({ data: {} })

    await uploadSolomonisParty(deckResponse, { shareWithCrew: true })

    expect(authenticatedPost).toHaveBeenLastCalledWith(
      '/parties/a%2Fb%3Fc%23d%20e/shares',
      {}
    )
  })

  it('posts nothing for a capture that is not a deck', async () => {
    expect(await uploadSolomonisParty({})).toEqual({ error: 'invalid_data' })
    expect(authenticatedPost).not.toHaveBeenCalled()
  })
})
