import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedPost } from './api-client.js'
import { handleCreateCrew } from './crew.js'

vi.mock('./api-client.js', () => ({ authenticatedPost: vi.fn() }))

beforeEach(() => {
  vi.stubGlobal('chrome', {
    storage: { local: { get: vi.fn(async () => ({})), set: vi.fn() } }
  })
})

describe('handleCreateCrew', () => {
  it('reports a crew that already exists', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({
      error: 'invalid_data',
      message: 'Validation failed: Granblue crew has already been taken'
    })

    await expect(handleCreateCrew('Crew')).resolves.toEqual({
      error: 'crew_already_exists'
    })
  })

  it('passes other error codes through', async () => {
    vi.mocked(authenticatedPost).mockResolvedValue({
      error: 'already_in_crew',
      message: 'You are already in a crew'
    })

    await expect(handleCreateCrew('Crew')).resolves.toEqual({
      error: 'already_in_crew'
    })
  })
})
