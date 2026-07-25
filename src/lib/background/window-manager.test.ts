import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createWindowManager,
  type WindowManagerDependencies
} from './window-manager.js'

function createDependencies(): WindowManagerDependencies {
  return {
    onActionClicked: vi.fn(),
    onWindowRemoved: vi.fn(),
    openSidePanel: vi.fn(),
    focusWindow: vi.fn(),
    createPopup: vi.fn()
  }
}

describe('window manager', () => {
  let dependencies: WindowManagerDependencies

  beforeEach(() => {
    dependencies = createDependencies()
  })

  it('opens the side panel for action clicks', () => {
    const manager = createWindowManager(dependencies)
    manager.registerListeners()

    const listener = vi.mocked(dependencies.onActionClicked).mock.calls[0]![0]
    listener({ windowId: 12 } as chrome.tabs.Tab)

    expect(dependencies.openSidePanel).toHaveBeenCalledWith(12)
  })

  it('creates, reuses, and releases a pop-out window', () => {
    const manager = createWindowManager(dependencies)
    manager.registerListeners()
    const firstResponse = vi.fn()

    expect(manager.handlePopOutWindow(firstResponse)).toBe(true)
    const createdCallback = vi.mocked(dependencies.createPopup).mock
      .calls[0]![0]
    createdCallback({ id: 44 } as chrome.windows.Window)
    expect(firstResponse).toHaveBeenCalledWith({
      windowId: 44,
      alreadyOpen: false
    })

    const secondResponse = vi.fn()
    expect(manager.handlePopOutWindow(secondResponse)).toBe(false)
    expect(dependencies.focusWindow).toHaveBeenCalledWith(44)
    expect(secondResponse).toHaveBeenCalledWith({
      windowId: 44,
      alreadyOpen: true
    })

    const removedListener = vi.mocked(dependencies.onWindowRemoved).mock
      .calls[0]![0]
    removedListener(44)

    expect(manager.handlePopOutWindow(vi.fn())).toBe(true)
    expect(dependencies.createPopup).toHaveBeenCalledTimes(2)
  })
})
