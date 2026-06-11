import { beforeEach, describe, expect, it, vi } from 'vitest'

const setHostname = (hostname: string) => {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname },
    configurable: true
  })
}

const setElementRect = (element: HTMLElement, rect: Partial<DOMRect>) => {
  element.getBoundingClientRect = vi.fn(() => ({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
    left: rect.left ?? 0,
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON: () => ({})
  } as DOMRect))
}

const flushMutations = () => new Promise((resolve) => window.setTimeout(resolve, 0))

const stubRequestAnimationFrame = () => {
  const origRaf = globalThis.requestAnimationFrame
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(performance.now())
    return 1
  })
  return origRaf
}

const createChatPanel = () => {
  const panel = document.createElement('section')
  panel.textContent = '发简历 换电话 按Enter键发送 面试安排 更多'
  setElementRect(panel, {
    top: 80,
    left: 360,
    right: 1320,
    bottom: 860,
    width: 960,
    height: 780
  })
  return panel
}

describe('BOSS chat width controls', () => {
  let origRaf: typeof requestAnimationFrame

  beforeEach(() => {
    vi.resetModules()
    origRaf = stubRequestAnimationFrame()
    document.head.innerHTML = ''
    document.body.innerHTML = ''
    setHostname('www.zhipin.com')
    Object.defineProperty(window, 'innerWidth', {
      value: 1440,
      configurable: true
    })
    Object.defineProperty(window, 'innerHeight', {
      value: 900,
      configurable: true
    })
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = origRaf
  })

  it('applies the chat panel width when the panel renders after the style tag', async () => {
    await import('./index')

    const panel = createChatPanel()
    document.body.appendChild(panel)
    await flushMutations()

    expect(panel.style.width).toBe('680px')
    expect(panel.style.flex).toBe('0 0 680px')
  })

  it('uses important sizing styles to override BOSS layout constraints', async () => {
    await import('./index')

    const panel = createChatPanel()
    document.body.appendChild(panel)
    await flushMutations()

    expect(panel.style.getPropertyPriority('width')).toBe('important')
    expect(panel.style.getPropertyValue('min-width')).toBe('0px')
    expect(panel.style.getPropertyPriority('min-width')).toBe('important')
    expect(panel.style.getPropertyPriority('flex-basis')).toBe('important')
  })

  it('keeps applying the width when BOSS replaces the chat panel', async () => {
    await import('./index')

    const firstPanel = createChatPanel()
    document.body.appendChild(firstPanel)
    await flushMutations()

    firstPanel.remove()
    const replacementPanel = createChatPanel()
    document.body.appendChild(replacementPanel)
    await flushMutations()

    expect(replacementPanel.style.width).toBe('680px')
    expect(replacementPanel.style.flex).toBe('0 0 680px')
  })

  it('reapplies the width when BOSS overwrites the panel style attribute', async () => {
    await import('./index')

    const panel = createChatPanel()
    document.body.appendChild(panel)
    await flushMutations()

    panel.style.width = '960px'
    panel.style.flex = '1 1 auto'
    await flushMutations()

    expect(panel.style.width).toBe('680px')
    expect(panel.style.flex).toBe('0 0 680px')
    expect(panel.style.getPropertyPriority('width')).toBe('important')
  })
})
