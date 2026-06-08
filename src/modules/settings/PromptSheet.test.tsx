import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { PromptSheet } from '@/modules/settings/PromptSheet'

const initialPrompts = [
  {
    promptId: 'global_system',
    scope: 'global',
    version: '1.0.0',
    content: 'System prompt',
    updatedAt: '2026-01-01T00:00:00Z',
    isDefault: true,
  },
  {
    promptId: 'role_advisor',
    scope: 'role',
    targetId: 'advisor',
    version: '2.1.0',
    content: 'Role prompt',
    updatedAt: '2026-01-02T00:00:00Z',
    isDefault: false,
  },
]

const updatedPrompt = {
  promptId: 'global_system',
  scope: 'global',
  version: '1.0.1',
  content: 'Updated prompt',
  updatedAt: '2026-01-03T00:00:00Z',
  isDefault: false,
}

const resetPrompt = {
  promptId: 'role_advisor',
  scope: 'role',
  targetId: 'advisor',
  version: '2.1.1',
  content: 'Role prompt',
  updatedAt: '2026-01-04T00:00:00Z',
  isDefault: true,
}

describe('PromptSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders nothing when isOpen is false', () => {
    render(<PromptSheet isOpen={false} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/prompt|提示词/i)).not.toBeInTheDocument()
  })

  it('loads prompts list from API on mount', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/prompts')
    })
  })

  it('groups prompts by global and role scope', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/全局.*prompt|global.*prompt/i)).toBeInTheDocument()
      expect(screen.getByText(/角色.*prompt|role.*prompt/i)).toBeInTheDocument()
    })
  })

  it('shows prompt metadata and enters edit mode when an item is clicked', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('global_system')).toBeInTheDocument()
      expect(screen.getByText(/1\.0\.0/)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('global_system'))

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByDisplayValue('System prompt')).toBeInTheDocument()
    })
  })

  it('shows save confirmation before updating prompt content', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('global_system')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('global_system'))
    await waitFor(() => {
      expect(screen.getByText(/保存|save/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/保存|save/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
  })

  it('does not call PUT when save confirmation is cancelled', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('global_system')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('global_system'))
    await waitFor(() => {
      expect(screen.getByText(/保存|save/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/保存|save/i))
    await waitFor(() => {
      expect(screen.getByText(/取消|cancel/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/取消|cancel/i))

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('calls PUT /api/settings/prompts with promptId and content after save confirm', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedPrompt, requestId: 'save-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [updatedPrompt, initialPrompts[1]], requestId: 'reload-1' }),
      })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('global_system')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('global_system'))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated prompt' } })
    fireEvent.click(screen.getByText(/保存|save/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/prompts',
        expect.objectContaining({ method: 'PUT' })
      )
    })

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
      promptId: 'global_system',
      content: 'Updated prompt',
    })
  })

  it('refreshes version, updatedAt and isDefault after save succeeds', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedPrompt, requestId: 'save-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [updatedPrompt, initialPrompts[1]], requestId: 'reload-1' }),
      })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('global_system')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('global_system'))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated prompt' } })
    fireEvent.click(screen.getByText(/保存|save/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(screen.getByText(/1\.0\.1/)).toBeInTheDocument()
      expect(screen.getByText(/2026-01-03/i)).toBeInTheDocument()
    })
  })

  it('shows restore default confirmation when prompt is customized', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('role_advisor')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('role_advisor'))
    await waitFor(() => {
      expect(screen.getByText(/恢复.*默认|restore.*default/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/恢复.*默认|restore.*default/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
  })

  it('does not call PUT when restore confirmation is cancelled', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('role_advisor')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('role_advisor'))
    await waitFor(() => {
      expect(screen.getByText(/恢复.*默认|restore.*default/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/恢复.*默认|restore.*default/i))
    await waitFor(() => {
      expect(screen.getByText(/取消|cancel/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/取消|cancel/i))

    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1)
  })

  it('calls PUT /api/settings/prompts with reset:true on restore', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: resetPrompt, requestId: 'reset-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [initialPrompts[0], resetPrompt], requestId: 'reload-1' }),
      })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('role_advisor')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('role_advisor'))
    await waitFor(() => {
      expect(screen.getByText(/恢复.*默认|restore.*default/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/恢复.*默认|restore.*default/i))
    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/prompts',
        expect.objectContaining({ method: 'PUT' })
      )
    })

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
      promptId: 'role_advisor',
      reset: true,
    })
  })

  it('refreshes version, updatedAt and isDefault after restore succeeds', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: resetPrompt, requestId: 'reset-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [initialPrompts[0], resetPrompt], requestId: 'reload-1' }),
      })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('role_advisor')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('role_advisor'))
    await waitFor(() => {
      expect(screen.getByText(/恢复.*默认|restore.*default/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/恢复.*默认|restore.*default/i))
    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(screen.getByText(/2\.1\.1/)).toBeInTheDocument()
      expect(screen.getByText(/2026-01-04/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no prompts are configured', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [], requestId: 'list-empty' }),
    })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/暂无|empty|no.*prompt|没有.*prompt/i)).toBeInTheDocument()
    })
  })

  it('calls onSaved after successful save confirm', async () => {
    const onSaved = vi.fn()
    ;(global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: initialPrompts, requestId: 'list-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedPrompt, requestId: 'save-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [updatedPrompt, initialPrompts[1]], requestId: 'reload-1' }),
      })

    render(<PromptSheet isOpen={true} onClose={vi.fn()} onSaved={onSaved} />)

    await waitFor(() => {
      expect(screen.getByText('global_system')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('global_system'))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated prompt' } })
    fireEvent.click(screen.getByText(/保存|save/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
  })

  it('closes sheet on close button click', () => {
    const onClose = vi.fn()
    render(<PromptSheet isOpen={true} onClose={onClose} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /✕|关闭|close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
