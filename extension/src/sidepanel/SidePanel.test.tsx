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
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    render(<SidePanel />)

    await user.click(await screen.findByText(DEFAULT_SNIPPET_CONTENTS[0]))

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(DEFAULT_SNIPPET_CONTENTS[0])
    })
  })
})
