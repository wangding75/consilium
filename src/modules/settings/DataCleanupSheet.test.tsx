import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DataCleanupSheet } from '@/modules/settings/DataCleanupSheet'

function mockCountsApi(): void {
  ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/sessions') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            sessions: [
              { sessionId: 's1', topic: 'Test 1' },
              { sessionId: 's2', topic: 'Test 2' },
            ],
          },
          requestId: 'sessions-1',
        }),
      }
    }

    if (url === '/api/llm/providers') {
      return {
        ok: true,
        json: async () => ({ success: true, data: [{ providerId: 'openai' }, { providerId: 'anthropic' }], requestId: 'providers-1' }),
      }
    }

    if (url === '/api/settings/prompts') {
      return {
        ok: true,
        json: async () => ({ success: true, data: [{ promptId: 'global_system' }], requestId: 'prompts-1' }),
      }
    }

    if (url === '/api/settings/clear' && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ success: true, data: null, requestId: 'clear-1' }),
      }
    }

    return { ok: true, json: async () => ({ success: true, data: null, requestId: 'fallback' }) }
  })
}

describe('DataCleanupSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders nothing when isOpen is false', () => {
    render(<DataCleanupSheet isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText(/清理|clean|数据/i)).not.toBeInTheDocument()
  })

  it('renders cleanup sheet with title when open', () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText(/数据.*安全|data.*security|清理/i)).toBeInTheDocument()
  })

  it('shows three cleanup options', () => {
    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    expect(screen.getByText(/清理.*会话|clean.*session/i)).toBeInTheDocument()
    expect(screen.getByText(/清理.*设置|clean.*setting/i)).toBeInTheDocument()
    expect(screen.getByText(/清理.*全部|clean.*all/i)).toBeInTheDocument()
  })

  it('loads counts from sessions, providers and prompts APIs', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/sessions')
      expect(global.fetch).toHaveBeenCalledWith('/api/llm/providers')
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/prompts')
    })
  })

  it('shows derived data counts when APIs succeed', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/2.*会话|会话.*2|2.*session|session.*2/i)).toBeInTheDocument()
      expect(screen.getByText(/1.*prompt|prompt.*1|1.*提示词|提示词.*1/i)).toBeInTheDocument()
    })
  })

  it('shows 暂无法统计 when count fetch fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'))

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/暂无法统计|unavailable/i)).toBeInTheDocument()
    })
  })

  it('shows confirmation dialog when clicking 清理会话', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*会话|clean.*session/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
  })

  it('shows confirmation dialog when clicking 清理设置', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*设置|clean.*setting/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
  })

  it('shows high-risk warning when cleanup includes provider settings', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*设置|clean.*setting/i))

    await waitFor(() => {
      expect(screen.getByText(/provider.*不可用|provider.*unavailable|重新配置|reconfigure/i)).toBeInTheDocument()
    })
  })

  it('shows high-risk warning in clear-all flow', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*全部|clean.*all/i))

    await waitFor(() => {
      expect(screen.getByText(/provider.*不可用|provider.*unavailable|重新配置|reconfigure/i)).toBeInTheDocument()
    })
  })

  it('starts the three-step confirmation flow for clear all', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*全部|clean.*all/i))

    await waitFor(() => {
      expect(screen.getByText(/影响.*范围|impact.*scope|步骤.*1|step.*1/i)).toBeInTheDocument()
    })
  })

  it('requires typing the confirmation word in clear-all step 2', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*全部|clean.*all/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下一步|继续|next|continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /下一步|继续|next|continue/i }))

    await waitFor(() => {
      expect(screen.getByText('确认删除')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  it('posts sessions scope after session cleanup confirm', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*会话|clean.*session/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/clear',
        expect.objectContaining({ method: 'POST' })
      )
    })

    const clearCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find((call) => call[0] === '/api/settings/clear')
    expect(clearCall).toBeDefined()
    expect(JSON.parse((clearCall?.[1] as RequestInit).body as string)).toEqual({ scope: 'sessions' })
  })

  it('posts settings scope after settings cleanup confirm', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*设置|clean.*setting/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      const clearCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find((call) => call[0] === '/api/settings/clear')
      expect(clearCall).toBeDefined()
      expect(JSON.parse((clearCall?.[1] as RequestInit).body as string)).toEqual({ scope: 'settings' })
    })
  })

  it('posts all scope after completing the full clear-all confirmation flow', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*全部|clean.*all/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下一步|继续|next|continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /下一步|继续|next|continue/i }))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '确认删除' } })
    fireEvent.click(screen.getByRole('button', { name: /下一步|继续|next|continue/i }))
    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      const clearCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find((call) => call[0] === '/api/settings/clear')
      expect(clearCall).toBeDefined()
      expect(JSON.parse((clearCall?.[1] as RequestInit).body as string)).toEqual({ scope: 'all' })
    })
  })

  it('does not call clear API when confirmation dialog is cancelled', async () => {
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*会话|clean.*session/i))

    await waitFor(() => {
      expect(screen.getByText(/取消|cancel/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/取消|cancel/i))

    const clearCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((call) => call[0] === '/api/settings/clear')
    expect(clearCalls).toHaveLength(0)
  })

  it('calls onClose after successful clear-all completion', async () => {
    const onClose = vi.fn()
    mockCountsApi()

    render(<DataCleanupSheet isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByText(/清理.*全部|clean.*all/i))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /下一步|继续|next|continue/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /下一步|继续|next|continue/i }))
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '确认删除' } })
    fireEvent.click(screen.getByRole('button', { name: /下一步|继续|next|continue/i }))
    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('keeps the sheet open and shows error state when cleanup fails', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/sessions') {
        return { ok: true, json: async () => ({ success: true, data: { sessions: [] }, requestId: 'sessions-1' }) }
      }
      if (url === '/api/llm/providers') {
        return { ok: true, json: async () => ({ success: true, data: [], requestId: 'providers-1' }) }
      }
      if (url === '/api/settings/prompts') {
        return { ok: true, json: async () => ({ success: true, data: [], requestId: 'prompts-1' }) }
      }
      if (url === '/api/settings/clear' && init?.method === 'POST') {
        return {
          ok: false,
          json: async () => ({ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'failed' }, requestId: 'clear-fail' }),
        }
      }
      return { ok: true, json: async () => ({ success: true, data: null, requestId: 'fallback' }) }
    })

    render(<DataCleanupSheet isOpen={true} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText(/清理.*会话|clean.*session/i))

    await waitFor(() => {
      expect(screen.getByText(/确认|confirm/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/确认|confirm/i))

    await waitFor(() => {
      expect(screen.getByText(/失败|error|failed/i)).toBeInTheDocument()
    })
  })

  it('closes sheet on close button click', () => {
    const onClose = vi.fn()
    render(<DataCleanupSheet isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /✕|关闭|close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
