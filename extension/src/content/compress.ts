const COMPACT_WIDTH = 680
const MIN_WIDTH = 640
const MAX_WIDTH = 900
const STYLE_ID = 'hi-boss-compact-style'
const PANEL_ATTR = 'data-hi-boss-compact'

let active = false
let observer: MutationObserver | null = null
let frameId = 0

function clampWidth(width: number) {
  const viewportLimit = Math.max(MIN_WIDTH, window.innerWidth - 420)
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, viewportLimit, width))
}

function isVisible(element: Element) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  )
}

function scorePanel(element: Element) {
  if (!(element instanceof HTMLElement)) return 0
  if (!isVisible(element)) return 0

  const rect = element.getBoundingClientRect()
  if (rect.width < 430 || rect.height < 380) return 0
  if (rect.left < 260 || rect.top > 180) return 0

  const text = element.innerText || element.textContent || ''
  let score = 0

  if (/电话/.test(text)) score += 16
  if (/面试安排/.test(text)) score += 16
  if (/更多/.test(text)) score += 8
  if (/发简历|换电话|换微信/.test(text)) score += 16
  if (/按Enter键发送|Ctrl\+Enter|发送/.test(text)) score += 12
  if (rect.right > window.innerWidth * 0.7) score += 10
  if (rect.height > window.innerHeight * 0.58) score += 8

  return score
}

function detectChatPanel() {
  const candidates = Array.from(document.body.querySelectorAll('*'))
  let best: Element | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    const score = scorePanel(candidate)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return bestScore >= 32 ? (best as HTMLElement) : null
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    [${PANEL_ATTR}="true"] {
      box-sizing: border-box !important;
      transition: width 120ms ease, flex-basis 120ms ease !important;
    }
  `
  document.head.appendChild(style)
}

function compressChatPanel() {
  if (!active || !document.body) return false

  const panel = detectChatPanel()
  if (!panel) return false

  const width = clampWidth(COMPACT_WIDTH)
  panel.setAttribute(PANEL_ATTR, 'true')
  panel.style.setProperty('width', `${width}px`, 'important')
  panel.style.setProperty('min-width', `${MIN_WIDTH}px`, 'important')
  panel.style.setProperty('max-width', `${width}px`, 'important')
  panel.style.setProperty('flex', `0 0 ${width}px`, 'important')
  panel.style.setProperty('flex-basis', `${width}px`, 'important')

  const parent = panel.parentElement
  if (parent) {
    parent.style.setProperty('max-width', 'none', 'important')
    parent.style.setProperty('box-sizing', 'border-box', 'important')
  }

  return true
}

function scheduleCompression() {
  if (frameId) return
  frameId = window.requestAnimationFrame(() => {
    frameId = 0
    compressChatPanel()
  })
}

export function startCompression() {
  active = true
  ensureStyle()
  scheduleCompression()

  if (!observer && document.body) {
    observer = new MutationObserver(scheduleCompression)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', scheduleCompression)
  }
}
