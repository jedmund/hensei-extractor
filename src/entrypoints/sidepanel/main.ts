import { mount } from 'svelte'
import App from '../../components/App.svelte'
import { getBrowserLocale, setLocale } from '../../lib/i18n.js'
import { applyTheme, watchSystemTheme } from '../../lib/theme.js'

// Render in the browser's language from the first frame. App applies a saved
// choice, if any, once storage has loaded.
setLocale(getBrowserLocale())

// Likewise the browser's light/dark until the account's theme has loaded.
applyTheme(undefined)
watchSystemTheme()

mount(App, { target: document.body })
