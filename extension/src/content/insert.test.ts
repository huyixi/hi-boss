import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findInputElement, insertSnippetText } from './insert'

const setHostname = (hostname: string) => {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hostname },
    configurable: true
  })
}

describe('content insertion', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setHostname('www.zhipin.com')
  })

  it('inserts text into a textarea and dispatches input and change events', () => {
    document.body.innerHTML = '<textarea style="width: 300px; height: 80px;"></textarea>'
    const textarea = document.querySelector('textarea')!
    const events: string[] = []
    textarea.addEventListener('input', () => events.push('input'))
    textarea.addEventListener('change', () => events.push('change'))

    const response = insertSnippetText('您好')

    expect(response).toEqual({ ok: true })
    expect(textarea.value).toBe('您好')
    expect(events).toEqual(['input', 'change'])
  })

  it('inserts text into an input', () => {
    document.body.innerHTML = '<input style="width: 300px; height: 40px;" />'
    const input = document.querySelector('input')!

    const response = insertSnippetText('您好')

    expect(response).toEqual({ ok: true })
    expect(input.value).toBe('您好')
  })

  it('inserts text into a contenteditable element', () => {
    document.body.innerHTML = '<div contenteditable="true" style="width: 300px; height: 80px;"></div>'
    const editable = document.querySelector('[contenteditable="true"]')!
    let inputEventCount = 0
    editable.addEventListener('input', () => inputEventCount += 1)

    const response = insertSnippetText('您好')

    expect(response).toEqual({ ok: true })
    expect(editable.textContent).toBe('您好')
    expect(inputEventCount).toBe(1)
  })

  it('ignores disabled, readonly, hidden, and tiny elements', () => {
    document.body.innerHTML = `
      <textarea disabled style="width: 300px; height: 80px;"></textarea>
      <input readonly style="width: 300px; height: 40px;" />
      <textarea style="display: none; width: 300px; height: 80px;"></textarea>
      <div contenteditable="true" style="width: 5px; height: 5px;"></div>
    `

    expect(findInputElement()).toBeNull()
    expect(insertSnippetText('您好')).toEqual({ ok: false, reason: 'NO_INPUT_FOUND' })
  })

  it('prefers BOSS platform selectors before generic selectors', () => {
    document.body.innerHTML = `
      <textarea style="width: 300px; height: 80px;">generic</textarea>
      <div class="chat-input" contenteditable="true" style="width: 300px; height: 80px;"></div>
    `

    const response = insertSnippetText('BOSS优先')

    expect(response).toEqual({ ok: true })
    expect(document.querySelector('.chat-input')?.textContent).toBe('BOSS优先')
    expect(document.querySelector('textarea')?.textContent).toBe('generic')
  })
})
