import { startCompression } from './compress'
import { insertSnippetText } from './insert'

startCompression()
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
