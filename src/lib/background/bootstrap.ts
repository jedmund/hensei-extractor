import { initDebugger } from '../debugger.js'
import { createDefaultCaptureHandler } from './capture.js'
import { createDefaultMessageListener } from './message-router.js'
import { createDefaultWindowManager } from './window-manager.js'

let initialized = false

export function initializeBackground(): void {
  if (initialized) return
  initialized = true

  initDebugger(createDefaultCaptureHandler())

  const windowManager = createDefaultWindowManager()
  windowManager.registerListeners()

  chrome.runtime.onMessage.addListener(
    createDefaultMessageListener(windowManager.handlePopOutWindow)
  )
}
