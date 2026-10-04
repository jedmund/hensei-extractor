import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchJobSkillSlugs,
  fetchWeaponKeyMap,
  fetchWeaponStatModifiers,
  searchSummonByName
} from './chrome-messages.js'

function stubSendMessage(
  impl: (message: unknown) => Promise<unknown>
): ReturnType<typeof vi.fn> {
  const sendMessage = vi.fn(impl)
  vi.stubGlobal('chrome', { runtime: { sendMessage } })
  return sendMessage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('party lookups', () => {
  it('sends each lookup to the background', async () => {
    const sendMessage = stubSendMessage(async () => ({ ok: true }))

    await searchSummonByName('Grimnir')
    await fetchWeaponKeyMap('ja')
    await fetchWeaponStatModifiers()
    await fetchJobSkillSlugs(['Rage IV'])

    expect(sendMessage.mock.calls.map(([message]) => message)).toEqual([
      { action: 'searchSummonByName', name: 'Grimnir' },
      { action: 'fetchWeaponKeyMap', locale: 'ja' },
      { action: 'fetchWeaponStatModifiers' },
      { action: 'fetchJobSkillSlugs', names: ['Rage IV'] }
    ])
  })

  // The party view awaits these together, so one failing must not stop it opening.
  it.each([
    ['the background is unreachable', () => Promise.reject(new Error('gone'))],
    ['there is no response', () => Promise.resolve(undefined)]
  ])('falls back when %s', async (_case, impl) => {
    stubSendMessage(impl)

    await expect(searchSummonByName('Grimnir')).resolves.toBeNull()
    await expect(fetchWeaponKeyMap('en')).resolves.toBeNull()
    await expect(fetchWeaponStatModifiers()).resolves.toBeNull()
    await expect(fetchJobSkillSlugs(['Rage IV', 'Mist'])).resolves.toEqual({
      'Rage IV': null,
      Mist: null
    })
  })
})
