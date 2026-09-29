/**
 * Background service worker for the Granblue Fantasy Chrome extension.
 * Uses passive Chrome DevTools Protocol interception and never makes requests
 * to Granblue Fantasy servers.
 */

import { initializeBackground } from './background/bootstrap.js'

initializeBackground()
