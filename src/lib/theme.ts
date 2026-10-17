/**
 * Light or dark, from the granblue.team account's theme setting ('system',
 * 'light' or 'dark'), like the site. Logged out, or on 'system', the panel
 * follows the browser. The styles key off <html data-theme>.
 */

export type Theme = 'light' | 'dark'

export function resolveTheme(
  preference: string | undefined,
  systemDark: boolean
): Theme {
  if (preference === 'light' || preference === 'dark') return preference
  return systemDark ? 'dark' : 'light'
}

function systemDarkQuery(): MediaQueryList {
  return window.matchMedia('(prefers-color-scheme: dark)')
}

let currentPreference: string | undefined

/** Applies the account's theme setting to the panel. */
export function applyTheme(preference: string | undefined): void {
  currentPreference = preference
  document.documentElement.dataset.theme = resolveTheme(
    preference,
    systemDarkQuery().matches
  )
}

/** Keeps a 'system' theme in step when the browser switches light/dark. */
export function watchSystemTheme(): void {
  systemDarkQuery().addEventListener('change', () =>
    applyTheme(currentPreference)
  )
}
