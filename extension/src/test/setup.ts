import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { chromeMock } from './chromeMock'

vi.stubGlobal('chrome', chromeMock)

beforeEach(() => {
  const writeText = vi.fn(async () => undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
    configurable: true
  })
})

afterEach(() => {
  chromeMock.reset()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

export const getClipboardWriteText = () => navigator.clipboard.writeText as ReturnType<typeof vi.fn>
