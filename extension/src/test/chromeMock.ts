import { vi } from 'vitest'

type StorageArea = Record<string, unknown>

const storage: StorageArea = {}

export const chromeMock = {
  storageData: storage,
  reset() {
    Object.keys(storage).forEach((key) => delete storage[key])
    chromeMock.runtime.lastError = undefined
    chromeMock.tabs.query.mockClear()
    chromeMock.tabs.sendMessage.mockClear()
    chromeMock.action.onClicked.addListener.mockClear()
    chromeMock.sidePanel.open.mockClear()
    chromeMock.sidePanel.setPanelBehavior.mockClear()
  },
  runtime: {
    lastError: undefined as chrome.runtime.LastError | undefined,
    onMessage: {
      addListener: vi.fn()
    }
  },
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
        if (typeof keys === 'string') return { [keys]: storage[keys] }
        if (Array.isArray(keys)) {
          return keys.reduce<Record<string, unknown>>((result, key) => {
            result[key] = storage[key]
            return result
          }, {})
        }
        if (keys && typeof keys === 'object') {
          return Object.entries(keys).reduce<Record<string, unknown>>((result, [key, fallback]) => {
            result[key] = storage[key] ?? fallback
            return result
          }, {})
        }
        return { ...storage }
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(storage, items)
      })
    }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  },
  action: {
    onClicked: {
      addListener: vi.fn()
    }
  },
  sidePanel: {
    open: vi.fn(async () => undefined),
    setPanelBehavior: vi.fn(async () => undefined)
  }
}
