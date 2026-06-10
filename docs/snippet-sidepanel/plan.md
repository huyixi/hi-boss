# Snippet Side Panel Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Extension MV3 side panel that stores local recruiting chat snippets and inserts a clicked snippet into supported recruiting platform chat inputs.

**Architecture:** Create a self-contained `extension/` Vite + React + TypeScript project. The background service worker opens Chrome's native Side Panel, the side panel owns snippet CRUD and active-tab messaging, shared modules own storage/types/default snippets, and the content script owns platform detection plus text insertion.

**Tech Stack:** Chrome Extension Manifest V3, Chrome Side Panel API, `chrome.storage.local`, React 19, TypeScript, Vite, Vitest, React Testing Library.

---

## File Structure

- Create `package.json`: root npm scripts for extension development, build, typecheck, and tests.
- Create `extension/index.html`: Vite entry shim for development only.
- Create `extension/manifest.json`: MV3 manifest with side panel, background worker, declared content scripts, required permissions, and supported host permissions.
- Create `extension/src/background/index.ts`: listens for extension action clicks and opens the native Side Panel.
- Create `extension/src/sidepanel/index.html`: Chrome Side Panel document.
- Create `extension/src/sidepanel/main.tsx`: React mount entry.
- Create `extension/src/sidepanel/SidePanel.tsx`: snippet list, add/edit/delete UI, active-tab insert messaging, clipboard fallback.
- Create `extension/src/sidepanel/SidePanel.test.tsx`: side panel behavior tests for CRUD, trim validation, event isolation, insert fallback.
- Create `extension/src/content/index.ts`: content script message listener.
- Create `extension/src/content/insert.ts`: platform selector matching, input candidate filtering, and text insertion logic.
- Create `extension/src/content/insert.test.ts`: unit tests for textarea, input, contenteditable, visibility filtering, failure result.
- Create `extension/src/shared/types.ts`: `Snippet`, storage, and message protocol types.
- Create `extension/src/shared/defaultSnippets.ts`: three required default snippets.
- Create `extension/src/shared/storage.ts`: local storage initialization and CRUD helpers.
- Create `extension/src/shared/storage.test.ts`: tests for default initialization, empty-array preservation, append/update/delete ordering.
- Create `extension/src/test/chromeMock.ts`: deterministic Chrome API mock used by tests.
- Create `extension/src/test/setup.ts`: Vitest setup for DOM and Chrome mock reset.
- Create `extension/vite.config.ts`: builds side panel HTML plus background/content entries into `extension/dist`.
- Create `extension/tsconfig.json`: TypeScript config for extension code and tests.

---

### Task 1: Scaffold Tooling and Build Configuration

**Files:**
- Create: `package.json`
- Create: `extension/index.html`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`
- Create: `extension/src/test/setup.ts`
- Create: `extension/src/test/chromeMock.ts`

- [ ] **Step 1: Create the root package scripts**

Create `package.json`:

```json
{
  "name": "hi-boss-snippet-sidepanel",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --config extension/vite.config.ts",
    "build": "vite build --config extension/vite.config.ts",
    "typecheck": "tsc --noEmit -p extension/tsconfig.json",
    "test": "vitest run --config extension/vite.config.ts",
    "test:watch": "vitest --config extension/vite.config.ts"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/chrome": "^0.0.287",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "jsdom": "^25.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create the Vite development shell**

Create `extension/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>快捷话术</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/sidepanel/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create TypeScript config**

Create `extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["chrome", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "vite.config.ts", "manifest.json"]
}
```

- [ ] **Step 4: Create Chrome API test mock**

Create `extension/src/test/chromeMock.ts`:

```ts
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
```

- [ ] **Step 5: Create Vitest setup**

Create `extension/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { chromeMock } from './chromeMock'

vi.stubGlobal('chrome', chromeMock)

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(async () => undefined)
  }
})

afterEach(() => {
  chromeMock.reset()
  vi.clearAllMocks()
  document.body.innerHTML = ''
})
```

- [ ] **Step 6: Create Vite config**

Create `extension/vite.config.ts`:

```ts
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  }
})
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install`

Expected: `node_modules` is created and `pnpm-lock.yaml` is updated.

- [ ] **Step 8: Verify empty scaffold commands**

Run: `pnpm typecheck`

Expected: FAIL because source entry files are not created yet.

- [ ] **Step 9: Commit scaffold**

```bash
git add package.json pnpm-lock.yaml extension/index.html extension/tsconfig.json extension/vite.config.ts extension/src/test/setup.ts extension/src/test/chromeMock.ts
git commit -m "chore: scaffold extension tooling"
```

---

### Task 2: Shared Types, Default Snippets, and Storage

**Files:**
- Create: `extension/src/shared/types.ts`
- Create: `extension/src/shared/defaultSnippets.ts`
- Create: `extension/src/shared/storage.test.ts`
- Create: `extension/src/shared/storage.ts`

- [ ] **Step 1: Define shared protocol and storage types**

Create `extension/src/shared/types.ts`:

```ts
export type Snippet = {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

export type SnippetsStorage = {
  version: 1
  snippets: Snippet[]
}

export type InsertSnippetMessage = {
  type: 'INSERT_SNIPPET'
  payload: {
    content: string
  }
}

export type InsertSnippetResponse = {
  ok: boolean
  reason?: string
}
```

- [ ] **Step 2: Define the required default snippets**

Create `extension/src/shared/defaultSnippets.ts`:

```ts
export const DEFAULT_SNIPPET_CONTENTS = [
  '您好，我对这个岗位比较感兴趣，想进一步了解一下岗位情况。',
  '您好，我主要有前端/全栈开发经验，熟悉 Vue3、TypeScript、Node.js，也有独立完成项目的经验，想和您进一步沟通一下。',
  '您好，方便的话想跟进一下这个岗位的进展。如需补充简历、作品集或项目资料，我可以进一步提供。'
] as const
```

- [ ] **Step 3: Write storage behavior tests**

Create `extension/src/shared/storage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { chromeMock } from '../test/chromeMock'
import { DEFAULT_SNIPPET_CONTENTS } from './defaultSnippets'
import {
  addSnippet,
  deleteSnippet,
  getSnippets,
  initializeSnippetsStorage,
  updateSnippet
} from './storage'

describe('snippet storage', () => {
  it('initializes defaults when snippets storage is missing', async () => {
    const result = await initializeSnippetsStorage()

    expect(result.version).toBe(1)
    expect(result.snippets).toHaveLength(3)
    expect(result.snippets.map((snippet) => snippet.content)).toEqual([...DEFAULT_SNIPPET_CONTENTS])
    expect(chromeMock.storageData.snippetsStorage).toEqual(result)
  })

  it('does not reinitialize defaults when storage exists with an empty snippets array', async () => {
    chromeMock.storageData.snippetsStorage = { version: 1, snippets: [] }

    const result = await initializeSnippetsStorage()

    expect(result).toEqual({ version: 1, snippets: [] })
  })

  it('adds a trimmed snippet to the end of the list', async () => {
    await initializeSnippetsStorage()

    const added = await addSnippet('  新话术  ')
    const snippets = await getSnippets()

    expect(added.content).toBe('新话术')
    expect(snippets.at(-1)).toEqual(added)
  })

  it('rejects empty snippets after trimming', async () => {
    await initializeSnippetsStorage()

    await expect(addSnippet('   ')).rejects.toThrow('Snippet content cannot be empty')
  })

  it('updates a snippet without changing order or createdAt', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const first = await addSnippet('第一条')
    const second = await addSnippet('第二条')

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
    const updated = await updateSnippet(first.id, '  第一条更新  ')
    const snippets = await getSnippets()

    expect(updated.content).toBe('第一条更新')
    expect(updated.createdAt).toBe(first.createdAt)
    expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(snippets.map((snippet) => snippet.id)).toEqual([first.id, second.id])
  })

  it('deletes a snippet without reordering remaining snippets', async () => {
    const first = await addSnippet('第一条')
    const second = await addSnippet('第二条')
    const third = await addSnippet('第三条')

    await deleteSnippet(second.id)
    const snippets = await getSnippets()

    expect(snippets.map((snippet) => snippet.id)).toEqual([first.id, third.id])
  })
})
```

- [ ] **Step 4: Run storage tests to verify they fail**

Run: `pnpm test extension/src/shared/storage.test.ts`

Expected: FAIL because `extension/src/shared/storage.ts` does not exist.

- [ ] **Step 5: Implement storage helpers**

Create `extension/src/shared/storage.ts`:

```ts
import { DEFAULT_SNIPPET_CONTENTS } from './defaultSnippets'
import type { Snippet, SnippetsStorage } from './types'

const STORAGE_KEY = 'snippetsStorage'
const STORAGE_VERSION = 1

const createId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `snippet-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const nowIso = () => new Date().toISOString()

const createSnippet = (content: string): Snippet => {
  const timestamp = nowIso()
  return {
    id: createId(),
    content,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

const readStorage = async (): Promise<SnippetsStorage | undefined> => {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return result[STORAGE_KEY] as SnippetsStorage | undefined
}

const writeStorage = async (value: SnippetsStorage): Promise<SnippetsStorage> => {
  await chrome.storage.local.set({ [STORAGE_KEY]: value })
  return value
}

const normalizeContent = (content: string) => {
  const trimmed = content.trim()
  if (!trimmed) throw new Error('Snippet content cannot be empty')
  return trimmed
}

export const initializeSnippetsStorage = async (): Promise<SnippetsStorage> => {
  const existing = await readStorage()
  if (existing) return existing

  return writeStorage({
    version: STORAGE_VERSION,
    snippets: DEFAULT_SNIPPET_CONTENTS.map((content) => createSnippet(content))
  })
}

export const getSnippets = async (): Promise<Snippet[]> => {
  const storage = await initializeSnippetsStorage()
  return storage.snippets
}

export const addSnippet = async (content: string): Promise<Snippet> => {
  const storage = await initializeSnippetsStorage()
  const snippet = createSnippet(normalizeContent(content))
  await writeStorage({
    version: STORAGE_VERSION,
    snippets: [...storage.snippets, snippet]
  })
  return snippet
}

export const updateSnippet = async (id: string, content: string): Promise<Snippet> => {
  const storage = await initializeSnippetsStorage()
  const existing = storage.snippets.find((snippet) => snippet.id === id)
  if (!existing) throw new Error(`Snippet not found: ${id}`)

  const updated: Snippet = {
    ...existing,
    content: normalizeContent(content),
    updatedAt: nowIso()
  }

  await writeStorage({
    version: STORAGE_VERSION,
    snippets: storage.snippets.map((snippet) => (snippet.id === id ? updated : snippet))
  })
  return updated
}

export const deleteSnippet = async (id: string): Promise<void> => {
  const storage = await initializeSnippetsStorage()
  await writeStorage({
    version: STORAGE_VERSION,
    snippets: storage.snippets.filter((snippet) => snippet.id !== id)
  })
}
```

- [ ] **Step 6: Run storage tests to verify they pass**

Run: `pnpm test extension/src/shared/storage.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit shared storage**

```bash
git add extension/src/shared/types.ts extension/src/shared/defaultSnippets.ts extension/src/shared/storage.ts extension/src/shared/storage.test.ts
git commit -m "feat: add local snippet storage"
```

---

### Task 3: Content Script Insertion Logic

**Files:**
- Create: `extension/src/content/insert.test.ts`
- Create: `extension/src/content/insert.ts`
- Create: `extension/src/content/index.ts`

- [ ] **Step 1: Write content insertion tests**

Create `extension/src/content/insert.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { findInputElement, insertSnippetText } from './insert'

describe('content insertion', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    history.replaceState(null, '', 'https://www.zhipin.com/web/geek/chat')
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
```

- [ ] **Step 2: Run content tests to verify they fail**

Run: `pnpm test extension/src/content/insert.test.ts`

Expected: FAIL because `extension/src/content/insert.ts` does not exist.

- [ ] **Step 3: Implement platform-aware insertion**

Create `extension/src/content/insert.ts`:

```ts
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
```

- [ ] **Step 4: Create content script message listener**

Create `extension/src/content/index.ts`:

```ts
import { insertSnippetText } from './insert'
import type { InsertSnippetMessage, InsertSnippetResponse } from '../shared/types'

chrome.runtime.onMessage.addListener(
  (
    message: InsertSnippetMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: InsertSnippetResponse) => void
  ) => {
    if (message?.type !== 'INSERT_SNIPPET') return false

    sendResponse(insertSnippetText(message.payload.content))
    return false
  }
)
```

- [ ] **Step 5: Run content tests to verify they pass**

Run: `pnpm test extension/src/content/insert.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit content script**

```bash
git add extension/src/content/insert.ts extension/src/content/index.ts extension/src/content/insert.test.ts
git commit -m "feat: insert snippets into recruiting chat inputs"
```

---

### Task 4: Manifest and Background Side Panel Opening

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/src/background/index.ts`

- [ ] **Step 1: Create MV3 manifest**

Create `extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "招聘平台快捷话术",
  "version": "0.1.0",
  "description": "在招聘平台聊天页快速插入本地快捷话术。",
  "permissions": ["storage", "sidePanel", "activeTab", "clipboardWrite"],
  "host_permissions": [
    "*://*.zhipin.com/*",
    "*://*.lagou.com/*",
    "*://*.zhaopin.com/*",
    "*://*.51job.com/*",
    "*://*.liepin.com/*"
  ],
  "action": {
    "default_title": "快捷话术"
  },
  "background": {
    "service_worker": "assets/background.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "content_scripts": [
    {
      "matches": [
        "*://*.zhipin.com/*",
        "*://*.lagou.com/*",
        "*://*.zhaopin.com/*",
        "*://*.51job.com/*",
        "*://*.liepin.com/*"
      ],
      "js": ["assets/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 2: Implement background behavior**

Create `extension/src/background/index.ts`:

```ts
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined)

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.windowId) return
  await chrome.sidePanel.open({ windowId: tab.windowId })
})
```

- [ ] **Step 3: Build to verify manifest entry paths**

Run: `pnpm build`

Expected: FAIL until the side panel entry files from Task 5 exist. The generated output must eventually include `dist/assets/background.js` and `dist/assets/content.js`.

- [ ] **Step 4: Commit manifest and background**

```bash
git add extension/manifest.json extension/src/background/index.ts
git commit -m "feat: configure mv3 side panel extension"
```

---

### Task 5: Side Panel UI and Insert Messaging

**Files:**
- Create: `extension/src/sidepanel/index.html`
- Create: `extension/src/sidepanel/main.tsx`
- Create: `extension/src/sidepanel/SidePanel.test.tsx`
- Create: `extension/src/sidepanel/SidePanel.tsx`

- [ ] **Step 1: Create side panel HTML entry**

Create `extension/src/sidepanel/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>快捷话术</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create React mount entry**

Create `extension/src/sidepanel/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SidePanel } from './SidePanel'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>
)
```

- [ ] **Step 3: Write side panel tests**

Create `extension/src/sidepanel/SidePanel.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chromeMock } from '../test/chromeMock'
import { DEFAULT_SNIPPET_CONTENTS } from '../shared/defaultSnippets'
import { SidePanel } from './SidePanel'

describe('SidePanel', () => {
  beforeEach(() => {
    chromeMock.tabs.query.mockResolvedValue([{ id: 123, active: true }])
    chromeMock.tabs.sendMessage.mockResolvedValue({ ok: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders default snippets on first load', async () => {
    render(<SidePanel />)

    expect(await screen.findByText(DEFAULT_SNIPPET_CONTENTS[0])).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_SNIPPET_CONTENTS[1])).toBeInTheDocument()
    expect(screen.getByText(DEFAULT_SNIPPET_CONTENTS[2])).toBeInTheDocument()
  })

  it('adds a trimmed snippet at the end', async () => {
    const user = userEvent.setup()
    render(<SidePanel />)

    await user.type(await screen.findByLabelText('新增话术内容'), '  新增话术  ')
    await user.click(screen.getByRole('button', { name: '新增话术' }))

    const cards = screen.getAllByTestId('snippet-card')
    expect(cards.at(-1)).toHaveTextContent('新增话术')
  })

  it('does not save empty snippets', async () => {
    const user = userEvent.setup()
    render(<SidePanel />)

    await user.type(await screen.findByLabelText('新增话术内容'), '   ')
    await user.click(screen.getByRole('button', { name: '新增话术' }))

    expect(screen.getAllByTestId('snippet-card')).toHaveLength(3)
  })

  it('edits a snippet without triggering insertion', async () => {
    const user = userEvent.setup()
    render(<SidePanel />)

    await user.click(await screen.findByRole('button', { name: '编辑话术 1' }))
    const editor = screen.getByLabelText('编辑话术内容')
    await user.clear(editor)
    await user.type(editor, '  更新话术  ')
    await user.click(screen.getByRole('button', { name: '保存话术' }))

    expect(await screen.findByText('更新话术')).toBeInTheDocument()
    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('deletes after confirmation without triggering insertion', async () => {
    const user = userEvent.setup()
    render(<SidePanel />)

    await user.click(await screen.findByRole('button', { name: '删除话术 1' }))

    expect(window.confirm).toHaveBeenCalledWith('确认删除这条话术？')
    expect(screen.queryByText(DEFAULT_SNIPPET_CONTENTS[0])).not.toBeInTheDocument()
    expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled()
  })

  it('sends insert message when clicking a snippet card', async () => {
    const user = userEvent.setup()
    render(<SidePanel />)

    await user.click(await screen.findByText(DEFAULT_SNIPPET_CONTENTS[0]))

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true })
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(123, {
      type: 'INSERT_SNIPPET',
      payload: { content: DEFAULT_SNIPPET_CONTENTS[0] }
    })
  })

  it('copies to clipboard when insertion fails', async () => {
    const user = userEvent.setup()
    chromeMock.tabs.sendMessage.mockResolvedValue({ ok: false, reason: 'NO_INPUT_FOUND' })
    render(<SidePanel />)

    await user.click(await screen.findByText(DEFAULT_SNIPPET_CONTENTS[0]))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(DEFAULT_SNIPPET_CONTENTS[0])
    })
  })
})
```

- [ ] **Step 4: Run side panel tests to verify they fail**

Run: `pnpm test extension/src/sidepanel/SidePanel.test.tsx`

Expected: FAIL because `extension/src/sidepanel/SidePanel.tsx` does not exist.

- [ ] **Step 5: Implement the side panel**

Create `extension/src/sidepanel/SidePanel.tsx`:

```tsx
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addSnippet, deleteSnippet, getSnippets, updateSnippet } from '../shared/storage'
import type { InsertSnippetMessage, InsertSnippetResponse, Snippet } from '../shared/types'
import './sidepanel.css'

export const SidePanel = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const reloadSnippets = async () => {
    setSnippets(await getSnippets())
  }

  useEffect(() => {
    void reloadSnippets()
  }, [])

  const handleAdd = async () => {
    if (!draft.trim()) return
    await addSnippet(draft)
    setDraft('')
    await reloadSnippets()
  }

  const beginEdit = (snippet: Snippet) => {
    setEditingId(snippet.id)
    setEditingContent(snippet.content)
  }

  const saveEdit = async () => {
    if (!editingId || !editingContent.trim()) return
    await updateSnippet(editingId, editingContent)
    setEditingId(null)
    setEditingContent('')
    await reloadSnippets()
  }

  const removeSnippet = async (id: string) => {
    if (!window.confirm('确认删除这条话术？')) return
    await deleteSnippet(id)
    await reloadSnippets()
  }

  const insertSnippet = async (content: string) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const message: InsertSnippetMessage = { type: 'INSERT_SNIPPET', payload: { content } }

    if (!tab?.id) {
      await navigator.clipboard.writeText(content)
      return
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, message) as InsertSnippetResponse
      if (!response?.ok) await navigator.clipboard.writeText(content)
    } catch {
      await navigator.clipboard.writeText(content)
    }
  }

  return (
    <main className="shell">
      <header className="header">
        <h1>快捷话术</h1>
      </header>

      <section className="composer" aria-label="新增话术">
        <textarea
          aria-label="新增话术内容"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
        />
        <button type="button" onClick={handleAdd} aria-label="新增话术">
          <Plus size={16} />
          新增
        </button>
      </section>

      <section className="list" aria-label="话术列表">
        {snippets.map((snippet, index) => (
          <article
            key={snippet.id}
            data-testid="snippet-card"
            className="snippet"
            onClick={() => void insertSnippet(snippet.content)}
          >
            {editingId === snippet.id ? (
              <div className="edit" onClick={(event) => event.stopPropagation()}>
                <textarea
                  aria-label="编辑话术内容"
                  value={editingContent}
                  onChange={(event) => setEditingContent(event.target.value)}
                  rows={5}
                />
                <div className="actions">
                  <button type="button" onClick={saveEdit} aria-label="保存话术">
                    <Check size={16} />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="取消编辑">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{snippet.content}</p>
                <div className="actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" onClick={() => beginEdit(snippet)} aria-label={`编辑话术 ${index + 1}`}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => void removeSnippet(snippet.id)} aria-label={`删除话术 ${index + 1}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </section>
    </main>
  )
}
```

- [ ] **Step 6: Add side panel styles**

Create `extension/src/sidepanel/sidepanel.css`:

```css
:root {
  color: #18212f;
  background: #f7f8fa;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

button,
textarea {
  font: inherit;
}

.shell {
  min-height: 100vh;
  padding: 16px;
}

.header {
  margin-bottom: 12px;
}

.header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
}

.composer {
  display: grid;
  gap: 8px;
  margin-bottom: 16px;
}

textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid #d7dce3;
  border-radius: 8px;
  padding: 10px;
  color: #18212f;
  background: #ffffff;
}

.composer button {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  padding: 0 12px;
  color: #ffffff;
  background: #1f7a5a;
  cursor: pointer;
}

.list {
  display: grid;
  gap: 10px;
}

.snippet {
  display: grid;
  gap: 10px;
  border: 1px solid #e0e4ea;
  border-radius: 8px;
  padding: 12px;
  background: #ffffff;
  cursor: pointer;
}

.snippet p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.5;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.actions button {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid #d7dce3;
  border-radius: 8px;
  color: #334155;
  background: #ffffff;
  cursor: pointer;
}

.edit {
  display: grid;
  gap: 8px;
}
```

- [ ] **Step 7: Run side panel tests to verify they pass**

Run: `pnpm test extension/src/sidepanel/SidePanel.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit side panel UI**

```bash
git add extension/src/sidepanel/index.html extension/src/sidepanel/main.tsx extension/src/sidepanel/SidePanel.tsx extension/src/sidepanel/SidePanel.test.tsx extension/src/sidepanel/sidepanel.css
git commit -m "feat: add snippet side panel ui"
```

---

### Task 6: Full Build, Manifest Copy, and Manual Acceptance Checks

**Files:**
- Modify: `extension/vite.config.ts`
- Create: `extension/src/background/index.test.ts`

- [ ] **Step 1: Add manifest copy plugin to Vite**

Modify `extension/vite.config.ts` to this complete content:

```ts
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const copyManifest = (): Plugin => ({
  name: 'copy-manifest',
  closeBundle() {
    copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'))
  }
})

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react(), copyManifest()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  }
})
```

- [ ] **Step 2: Test background action registration**

Create `extension/src/background/index.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the full automated suite**

Run: `pnpm test`

Expected: PASS for shared storage, content insertion, background behavior, and side panel behavior.

- [ ] **Step 4: Run TypeScript validation**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Build the extension**

Run: `pnpm build`

Expected: PASS and these files exist:

```txt
extension/dist/manifest.json
extension/dist/src/sidepanel/index.html
extension/dist/assets/background.js
extension/dist/assets/content.js
```

- [ ] **Step 6: Inspect manifest for prohibited capabilities**

Run: `node -e "const m=require('./extension/dist/manifest.json'); console.log(JSON.stringify({permissions:m.permissions, host_permissions:m.host_permissions, popup:m.action.default_popup, content_scripts:m.content_scripts}, null, 2))"`

Expected output includes:

```json
{
  "permissions": ["storage", "sidePanel", "activeTab", "clipboardWrite"],
  "host_permissions": [
    "*://*.zhipin.com/*",
    "*://*.lagou.com/*",
    "*://*.zhaopin.com/*",
    "*://*.51job.com/*",
    "*://*.liepin.com/*"
  ],
  "content_scripts": [
    {
      "matches": [
        "*://*.zhipin.com/*",
        "*://*.lagou.com/*",
        "*://*.zhaopin.com/*",
        "*://*.51job.com/*",
        "*://*.liepin.com/*"
      ],
      "js": ["assets/content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

The printed `popup` value must be absent or `undefined`.

- [ ] **Step 7: Manually load extension in Chrome**

Manual steps:

```txt
1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select /Users/huyixi/i/hi-boss/extension/dist
5. Pin the extension action
6. Click the extension action
```

Expected: Chrome's native Side Panel opens and shows the three default snippets.

- [ ] **Step 8: Manually verify BOSS insertion**

Manual steps:

```txt
1. Open a BOSS直聘 chat page under https://www.zhipin.com/
2. Click a snippet card in the Side Panel
3. Inspect the chat input
```

Expected: snippet text appears in the chat input, the message is not sent, and the user can keep editing the text.

- [ ] **Step 9: Manually verify failure fallback**

Manual steps:

```txt
1. Open a supported recruiting domain page that has no visible chat input
2. Click a snippet card in the Side Panel
3. Paste into a local text editor
```

Expected: clicked snippet content is pasted from the clipboard and the Side Panel remains usable.

- [ ] **Step 10: Commit verification support**

```bash
git add extension/vite.config.ts extension/src/background/index.test.ts
git commit -m "test: verify extension build wiring"
```

---

## Spec Coverage Review

- MV3, Side Panel-only UI, no popup: Task 4 and Task 6.
- Required permissions and host permissions: Task 4 and Task 6.
- Local-only storage with no remote API: Task 2; no network code is introduced.
- Default snippet initialization rules: Task 2 tests missing storage and empty-array preservation.
- Data model without title/category/tags/usage/favorite/platform fields: Task 2 `types.ts`.
- Snippet add/edit/delete, trim, empty rejection, order preservation, delete confirmation: Task 2 and Task 5.
- Edit/delete click isolation from insertion: Task 5 tests event propagation.
- Message protocol: Task 2 `types.ts`, Task 3 content listener, Task 5 side panel sender.
- Insert behavior and clipboard fallback: Task 3 and Task 5.
- Input detection for textarea, input, and contenteditable: Task 3.
- BOSS P0 selectors plus basic selectors for Lagou, Zhaopin, 51job, Liepin: Task 3.
- No automatic send, no chat reads, no uploads: content script only writes to detected input and never reads chat history or calls network APIs.
