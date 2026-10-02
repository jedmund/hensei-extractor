import { mount } from 'svelte'
import App from '../../components/App.svelte'
import { getBrowserLocale, setLocale } from '../../lib/i18n.js'

// Render in the browser's language from the first frame. App applies a saved
// choice, if any, once storage has loaded.
setLocale(getBrowserLocale())

mount(App, { target: document.body })
