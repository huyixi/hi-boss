import { describe, expect, it } from 'vitest'
import { chromeMock } from '../test/chromeMock'

describe('background side panel behavior', () => {
  it('registers action click side panel opening', async () => {
    await import('./index')

    expect(chromeMock.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true })
    expect(chromeMock.action.onClicked.addListener).toHaveBeenCalledTimes(1)

    const listener = chromeMock.action.onClicked.addListener.mock.calls[0][0]
    await listener({ windowId: 42 })

    expect(chromeMock.sidePanel.open).toHaveBeenCalledWith({ windowId: 42 })
  })
})
