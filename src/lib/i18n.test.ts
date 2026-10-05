import { afterEach, describe, expect, it, vi } from 'vitest'

// The app state uses Svelte runes, which only compile inside components.
vi.mock('./state/app.svelte.js', () => ({ app: { locale: 'en' } }))

import {
  chooseLocale,
  translateError,
  getBrowserLocale,
  getLocale,
  getLocalizedName,
  getPreferredLocale,
  LOCALE_PREFERENCE_KEY,
  setLocale
} from './i18n.js'

function stubBrowserLanguage(uiLanguage: string) {
  const set = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('chrome', {
    i18n: { getUILanguage: () => uiLanguage },
    storage: { local: { set } }
  })
  return { set }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getBrowserLocale', () => {
  it('is Japanese for a Japanese browser', () => {
    stubBrowserLanguage('ja')
    expect(getBrowserLocale()).toBe('ja')
    stubBrowserLanguage('ja-JP')
    expect(getBrowserLocale()).toBe('ja')
  })

  it('is English for any other language', () => {
    stubBrowserLanguage('en-US')
    expect(getBrowserLocale()).toBe('en')
    stubBrowserLanguage('fr')
    expect(getBrowserLocale()).toBe('en')
  })
})

describe('getPreferredLocale', () => {
  it('uses a language the user picked', () => {
    stubBrowserLanguage('ja')
    expect(getPreferredLocale('en')).toBe('en')
    stubBrowserLanguage('en-US')
    expect(getPreferredLocale('ja')).toBe('ja')
  })

  it("falls back to the browser's language", () => {
    stubBrowserLanguage('ja-JP')
    expect(getPreferredLocale(undefined)).toBe('ja')
    expect(getPreferredLocale('de')).toBe('ja')
  })
})

describe('chooseLocale', () => {
  it('applies the language and remembers it', async () => {
    const { set } = stubBrowserLanguage('en-US')
    await chooseLocale('ja')
    expect(getLocale()).toBe('ja')
    expect(set).toHaveBeenCalledWith({ [LOCALE_PREFERENCE_KEY]: 'ja' })
    await chooseLocale('en')
  })
})

describe('getLocalizedName', () => {
  afterEach(() => {
    setLocale('en')
  })

  it('uses a plain string name as is', () => {
    setLocale('ja')
    expect(getLocalizedName({ name: 'Lucilius' })).toBe('Lucilius')
  })

  it('picks the name in the current language', () => {
    const raid = { name: { en: 'The World', ja: 'ワールド' } }
    expect(getLocalizedName(raid)).toBe('The World')
    setLocale('ja')
    expect(getLocalizedName(raid)).toBe('ワールド')
  })

  it('reads the flat name fields', () => {
    const group = { name_en: 'Six Dragons', name_jp: '六竜' }
    expect(getLocalizedName(group)).toBe('Six Dragons')
    setLocale('ja')
    expect(getLocalizedName(group)).toBe('六竜')
  })

  it('falls back to the other language', () => {
    expect(getLocalizedName({ name: { ja: 'ワールド' } })).toBe('ワールド')
    setLocale('ja')
    expect(getLocalizedName({ name: { en: 'The World' } })).toBe('The World')
  })

  it('is a translated "Unknown" without a name', () => {
    expect(getLocalizedName({})).toBe('Unknown')
    setLocale('ja')
    expect(getLocalizedName({ name: null })).toBe('不明')
  })
})

describe('translateError', () => {
  afterEach(() => setLocale('en'))

  it.each(['en', 'ja'])(
    'gives distinct actionable messages in %s',
    (locale) => {
      setLocale(locale)
      const codes = [
        'playlist_title_taken',
        'invalid_token',
        'forbidden',
        'not_found',
        'rate_limited',
        'invalid_data',
        'request_failed',
        'server_error',
        'internal_error'
      ]
      const messages = codes.map(translateError)
      expect(new Set(messages).size).toBe(codes.length)
      for (const message of messages) {
        expect(message.length).toBeGreaterThan(15)
        expect(codes).not.toContain(message)
      }
    }
  )

  it('asks for a different playlist name', () => {
    setLocale('en')
    expect(translateError('playlist_title_taken')).toBe(
      'You already have a playlist with this name. Please choose a different name.'
    )
  })

  it('does not show raw unknown errors or mislabel them as connection failures', () => {
    expect(translateError('private server exception')).toBe(
      translateError('request_rejected')
    )
    expect(translateError('toString')).toBe(translateError('request_rejected'))
    expect(translateError('unexpected')).not.toBe(
      translateError('request_failed')
    )
  })
})
