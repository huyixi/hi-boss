import type { InsertSnippetResponse } from '../shared/types'

type EditableElement = HTMLTextAreaElement | HTMLInputElement | HTMLElement

const PLATFORM_SELECTORS: Record<string, string[]> = {
  zhipin: [
    '.chat-input[contenteditable="true"]',
    '[class*="chat-input"][contenteditable="true"]',
    '[class*="input"][contenteditable="true"]',
    'textarea'
  ],
  lagou: ['textarea', '[contenteditable="true"]', 'input[type="text"]'],
  zhaopin: ['textarea', '[contenteditable="true"]', 'input[type="text"]'],
  '51job': ['textarea', '[contenteditable="true"]', 'input[type="text"]'],
  liepin: ['textarea', '[contenteditable="true"]', 'input[type="text"]']
}

const GENERIC_SELECTORS = [
  'textarea',
  'input[type="text"]',
  'input:not([type])',
  '[contenteditable="true"]'
]

const getPlatform = (hostname: string) => {
  if (hostname.endsWith('zhipin.com')) return 'zhipin'
  if (hostname.endsWith('lagou.com')) return 'lagou'
  if (hostname.endsWith('zhaopin.com')) return 'zhaopin'
  if (hostname.endsWith('51job.com')) return '51job'
  if (hostname.endsWith('liepin.com')) return 'liepin'
  return 'generic'
}

const getElementSize = (element: Element, style: CSSStyleDeclaration) => {
  const rect = element.getBoundingClientRect()
  return {
    width: rect.width || Number.parseFloat(style.width) || 0,
    height: rect.height || Number.parseFloat(style.height) || 0
  }
}

const isVisible = (element: Element) => {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const size = getElementSize(element, style)
  return size.width >= 20 && size.height >= 20
}

const isEditable = (element: Element) => {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  if (element instanceof HTMLInputElement) return !element.disabled && !element.readOnly
  if (element instanceof HTMLElement) return element.isContentEditable || element.getAttribute('contenteditable') === 'true'
  return false
}

const queryCandidates = (selectors: string[]) => {
  return selectors.flatMap((selector) => Array.from(document.querySelectorAll<EditableElement>(selector)))
}

export const findInputElement = (): EditableElement | null => {
  const platform = getPlatform(window.location.hostname)
  const platformSelectors = PLATFORM_SELECTORS[platform] ?? []
  const candidates = [...queryCandidates(platformSelectors), ...queryCandidates(GENERIC_SELECTORS)]

  return candidates.find((element) => isVisible(element) && isEditable(element)) ?? null
}

const dispatchTextEvents = (element: Element) => {
  element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

const setNativeValue = (element: HTMLTextAreaElement | HTMLInputElement, value: string) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
  descriptor?.set?.call(element, value)
}

export const insertSnippetText = (content: string): InsertSnippetResponse => {
  const element = findInputElement()
  if (!element) return { ok: false, reason: 'NO_INPUT_FOUND' }

  element.focus()

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? element.value.length
    const nextValue = `${element.value.slice(0, start)}${content}${element.value.slice(end)}`
    setNativeValue(element, nextValue)
    const nextCursor = start + content.length
    element.setSelectionRange(nextCursor, nextCursor)
    dispatchTextEvents(element)
    return { ok: true }
  }

  element.textContent = content
  dispatchTextEvents(element)
  return { ok: true }
}
