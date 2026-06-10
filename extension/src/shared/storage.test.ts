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
    vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'))
    const second = await addSnippet('第二条')

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'))
    const updated = await updateSnippet(first.id, '  第一条更新  ')
    const snippets = await getSnippets()

    expect(updated.content).toBe('第一条更新')
    expect(updated.createdAt).toBe(first.createdAt)
    expect(updated.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(snippets.at(-2)?.id).toBe(first.id)
    expect(snippets.at(-1)?.id).toBe(second.id)
  })

  it('deletes a snippet without reordering remaining snippets', async () => {
    const first = await addSnippet('第一条')
    const second = await addSnippet('第二条')
    const third = await addSnippet('第三条')

    const beforeDelete = await getSnippets()
    const firstIdx = beforeDelete.findIndex((s) => s.id === first.id)
    const thirdIdx = beforeDelete.findIndex((s) => s.id === third.id)

    await deleteSnippet(second.id)
    const snippets = await getSnippets()

    expect(snippets[firstIdx]?.id).toBe(first.id)
    expect(snippets[thirdIdx - 1]?.id).toBe(third.id)
  })
})
