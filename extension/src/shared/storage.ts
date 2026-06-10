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
