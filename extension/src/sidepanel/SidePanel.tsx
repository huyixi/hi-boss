import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { addSnippet, getSnippets } from '../shared/storage'
import type { InsertSnippetMessage, InsertSnippetResponse, Snippet } from '../shared/types'
import './sidepanel.css'

export const SidePanel = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [draft, setDraft] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const reloadSnippets = async () => {
    setSnippets(await getSnippets())
  }

  useEffect(() => {
    void reloadSnippets()
  }, [])

  useEffect(() => {
    if (dialogOpen) {
      textareaRef.current?.focus()
    }
  }, [dialogOpen])

  const handleAdd = async () => {
    if (!draft.trim()) return
    await addSnippet(draft)
    setDraft('')
    setDialogOpen(false)
    await reloadSnippets()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      void handleAdd()
    }
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
      <section className="list" aria-label="话术列表">
        {snippets.length === 0 ? (
          <p className="empty">暂无话术，点击下方按钮新增</p>
        ) : (
          snippets.map((snippet) => (
            <article
              key={snippet.id}
              data-testid="snippet-card"
              className="snippet"
              onClick={() => void insertSnippet(snippet.content)}
            >
              <p>{snippet.content}</p>
            </article>
          ))
        )}
      </section>

      <footer className="fab">
        <button type="button" onClick={() => { setDraft(''); setDialogOpen(true) }} aria-label="新增话术" title="新增话术">
          <Plus size={16} />
        </button>
      </footer>

      {dialogOpen && (
        <div className="dialog-backdrop" onClick={() => setDialogOpen(false)}>
          <div className="dialog" onClick={(event) => event.stopPropagation()}>
            <textarea
              ref={textareaRef}
              aria-label="新增话术内容"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入话术内容"
              rows={5}
            />
            <p className="dialog-hint">Cmd/Ctrl + Enter 快速新增</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setDialogOpen(false)}>取消</button>
              <button type="button" onClick={handleAdd}>新增</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
