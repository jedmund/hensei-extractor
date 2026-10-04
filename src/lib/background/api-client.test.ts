import { describe, expect, it } from 'vitest'
import { parseErrorBody } from './api-client.js'

function respond(body: unknown) {
  return new Response(JSON.stringify(body), { status: 422 })
}

describe('parseErrorBody', () => {
  it('reads a top-level error', async () => {
    await expect(
      parseErrorBody(respond({ error: 'invalid_data' }))
    ).resolves.toEqual({ error: 'invalid_data' })
  })

  it('reads per-item errors', async () => {
    const errors = [{ error: 'not_found', granblue_id: '1040001000' }]
    await expect(parseErrorBody(respond({ errors }))).resolves.toEqual({
      error: 'invalid_data',
      errors
    })
  })

  it('reads a rescued validation failure', async () => {
    const message = 'Validation failed: Granblue crew has already been taken'
    await expect(
      parseErrorBody(respond({ errors: { message } }))
    ).resolves.toEqual({ error: 'invalid_data', message })
  })

  it('reads a domain error code', async () => {
    await expect(
      parseErrorBody(
        respond({ message: 'Already in a crew', code: 'already_in_crew' })
      )
    ).resolves.toEqual({
      error: 'already_in_crew',
      message: 'Already in a crew'
    })
  })

  it('falls back to server_error', async () => {
    await expect(
      parseErrorBody(new Response('<html>', { status: 500 }))
    ).resolves.toEqual({ error: 'server_error' })
    await expect(parseErrorBody(respond({ errors: [] }))).resolves.toEqual({
      error: 'server_error'
    })
  })
})
