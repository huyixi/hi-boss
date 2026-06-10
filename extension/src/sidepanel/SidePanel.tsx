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
