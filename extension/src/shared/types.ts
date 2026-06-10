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
