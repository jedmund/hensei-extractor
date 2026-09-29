export interface WindowManagerDependencies {
  onActionClicked: (listener: (tab: chrome.tabs.Tab) => void) => void
  onWindowRemoved: (listener: (windowId: number) => void) => void
  openSidePanel: (windowId: number) => void
  focusWindow: (windowId: number) => void
  createPopup: (
    callback: (window: chrome.windows.Window | undefined) => void
  ) => void
}

export interface WindowManager {
  registerListeners: () => void
  popOutWindow: () => Promise<PopOutResult>
}

export interface PopOutResult {
  windowId?: number
  alreadyOpen: boolean
}

export function createWindowManager(
  dependencies: WindowManagerDependencies
): WindowManager {
  let popOutWindowId: number | null = null

  return {
    registerListeners() {
      dependencies.onActionClicked((tab) => {
        if (tab.windowId != null) {
          dependencies.openSidePanel(tab.windowId)
        }
      })

      dependencies.onWindowRemoved((windowId) => {
        if (windowId === popOutWindowId) {
          popOutWindowId = null
        }
      })
    },

    popOutWindow() {
      if (popOutWindowId) {
        dependencies.focusWindow(popOutWindowId)
        return Promise.resolve({ windowId: popOutWindowId, alreadyOpen: true })
      }

      return new Promise((resolve) => {
        dependencies.createPopup((window) => {
          popOutWindowId = window?.id ?? null
          resolve({ windowId: window?.id, alreadyOpen: false })
        })
      })
    }
  }
}

export function createDefaultWindowManager(): WindowManager {
  return createWindowManager({
    onActionClicked: (listener) =>
      chrome.action.onClicked.addListener(listener),
    onWindowRemoved: (listener) =>
      chrome.windows.onRemoved.addListener(listener),
    openSidePanel: (windowId) => {
      chrome.sidePanel.open({ windowId })
    },
    focusWindow: (windowId) => {
      chrome.windows.update(windowId, { focused: true })
    },
    createPopup: (callback) => {
      chrome.windows.create(
        {
          url: 'sidepanel.html',
          type: 'popup',
          width: 420,
          height: 700
        },
        callback
      )
    }
  })
}
