import { afterEach, describe, expect, it, vi } from 'vitest'

// The app state uses Svelte runes, which only compile inside components.
vi.mock('./state/app.svelte.js', () => ({ app: { locale: 'en' } }))

import {
  chooseLocale,
  getBrowserLocale,
  getLocale,
  getPreferredLocale,
  LOCALE_PREFERENCE_KEY
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
