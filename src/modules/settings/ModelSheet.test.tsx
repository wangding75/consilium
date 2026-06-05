import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ModelSheet } from '@/modules/settings/ModelSheet'

const enabledProvidersResponse = {
  success: true,
  data: [
    {
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      maskedKey: 'sk-***1234',
      modelList: ['gpt-4o', 'gpt-4.1'],
      maskedHeaders: {},
      lastTestStatus: 'success',
    },
    {
      providerId: 'anthropic',
      enabled: false,
      baseUrl: 'https://api.anthropic.com',
      maskedKey: 'sk-***abcd',
      modelList: ['claude-sonnet-4-6'],
      maskedHeaders: {},
      lastTestStatus: 'untested',
    },
  ],
  requestId: 'providers-1',
}

const defaultsResponse = {
  success: true,
  data: {
    providerId: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 512,
  },
  requestId: 'defaults-1',
}

const overridesResponse = {
  success: true,
  data: [
    {
      roleId: 'advisor',
      providerId: 'openai',
      model: 'gpt-4.1',
      temperature: 0.8,
      maxTokens: 1024,
    },
  ],
  requestId: 'overrides-1',
}

const templatesResponse = {
  success: true,
  data: {
    templates: [
      { templateId: 'tpl-1', roles: [{ id: 'advisor', name: 'Advisor' }, { id: 'critic', name: 'Critic' }] },
      { templateId: 'tpl-2', roles: [{ id: 'moderator', name: 'Moderator' }] },
    ],
  },
  requestId: 'templates-1',
}

function mockSheetData(): void {
  ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/settings/role-models' && init?.method === 'PUT') {
      return { ok: true, json: async () => overridesResponse }
    }

    if (url === '/api/settings/model-defaults' && init?.method === 'PUT') {
      return { ok: true, json: async () => defaultsResponse }
    }

    if (url === '/api/llm/providers') {
      return { ok: true, json: async () => enabledProvidersResponse }
    }

    if (url === '/api/settings/model-defaults') {
      return { ok: true, json: async () => defaultsResponse }
    }

    if (url === '/api/settings/role-models') {
      return { ok: true, json: async () => overridesResponse }
    }

    if (url === '/api/templates') {
      return { ok: true, json: async () => templatesResponse }
    }

    return { ok: true, json: async () => ({ success: true, data: null, requestId: 'fallback' }) }
  })
}

describe('ModelSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('renders nothing when isOpen is false', () => {
    render(<ModelSheet isOpen={false} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/模型|model/i)).not.toBeInTheDocument()
  })

  it('loads providers, defaults, overrides and templates when opened', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/llm/providers')
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/model-defaults')
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/role-models')
      expect(global.fetch).toHaveBeenCalledWith('/api/templates')
    })
  })

  it('renders global default model section and editable controls', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/全局.*默认|global.*default/i)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /provider|厂商/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/model|模型/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/temperature|温度/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/max.*tokens|最大.*tokens/i)).toBeInTheDocument()
    })
  })

  it('uses only enabled providers in the provider dropdown', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'openai' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'anthropic' })).not.toBeInTheDocument()
    })
  })

  it('shows empty state and disables save when no enabled providers exist', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/llm/providers') {
        return { ok: true, json: async () => ({ success: true, data: [], requestId: 'providers-empty' }) }
      }
      if (url === '/api/settings/model-defaults') {
        return { ok: true, json: async () => ({ success: true, data: null, requestId: 'defaults-empty' }) }
      }
      if (url === '/api/settings/role-models') {
        return { ok: true, json: async () => ({ success: true, data: [], requestId: 'overrides-empty' }) }
      }
      if (url === '/api/templates') {
        return { ok: true, json: async () => templatesResponse }
      }
      return { ok: true, json: async () => ({ success: true, data: null, requestId: 'fallback' }) }
    })

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/暂无|empty|no.*provider|没有.*provider/i)).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: /provider|厂商/i })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /保存|save/i })).toBeDisabled()
    })
  })

  it('shows role override section and existing override values', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/角色.*覆盖|role.*override/i)).toBeInTheDocument()
      expect(screen.getByText(/advisor/i)).toBeInTheDocument()
    })
  })

  it('falls back to existing overrides when templates API is unavailable', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/llm/providers') {
        return { ok: true, json: async () => enabledProvidersResponse }
      }
      if (url === '/api/settings/model-defaults') {
        return { ok: true, json: async () => defaultsResponse }
      }
      if (url === '/api/settings/role-models') {
        return { ok: true, json: async () => overridesResponse }
      }
      if (url === '/api/templates') {
        return { ok: false, json: async () => ({ success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'failed' }, requestId: 'templates-fail' }) }
      }
      return { ok: true, json: async () => ({ success: true, data: null, requestId: 'fallback' }) }
    })

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/advisor/i)).toBeInTheDocument()
    })
  })

  it('saves global model defaults via PUT /api/settings/model-defaults', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/model|模型/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/model|模型/i), { target: { value: 'gpt-4.1' } })
    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/model-defaults',
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  it('calls onSaved after successful defaults save', async () => {
    const onSaved = vi.fn()
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={onSaved} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/model|模型/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/model|模型/i), { target: { value: 'gpt-4.1' } })
    fireEvent.click(screen.getByRole('button', { name: /保存|save/i }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled()
    })
  })

  it('expands role overrides for editing without saving immediately', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/advisor/i)).toBeInTheDocument()
    })

    const fetchCallsBeforeExpand = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    fireEvent.click(screen.getByText(/advisor/i))

    await waitFor(() => {
      expect(screen.getByText(/清除.*覆盖|clear.*override/i)).toBeInTheDocument()
    })

    const fetchCallsAfterExpand = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length
    expect(fetchCallsAfterExpand).toBe(fetchCallsBeforeExpand)
  })

  it('shows clear override action after expanding a role entry', async () => {
    mockSheetData()

    render(<ModelSheet isOpen={true} onClose={vi.fn()} onSaved={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/advisor/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/advisor/i))

    await waitFor(() => {
      expect(screen.getByText(/清除.*覆盖|clear.*override/i)).toBeInTheDocument()
    })
  })

  it('closes sheet on close button click', () => {
    const onClose = vi.fn()
    render(<ModelSheet isOpen={true} onClose={onClose} onSaved={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /✕|关闭|close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
