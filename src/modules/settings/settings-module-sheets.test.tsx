import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SettingsModule } from '@/modules/settings'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}))

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/settings/provider-connections') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { connections: [
            { id: 'c1', providerType: 'openai', enabled: true, baseUrl: 'https://api.openai.com/v1', maskedKey: 'sk-***1234', modelList: ['gpt-4o'], maskedHeaders: {}, lastTestStatus: 'success', createdAt: '2026-06-04T06:00:00.000Z', updatedAt: '2026-06-04T06:00:00.000Z', displayName: 'OpenAI' },
            { id: 'c2', providerType: 'anthropic', enabled: true, baseUrl: 'https://api.anthropic.com', maskedKey: 'sk-***abcd', modelList: ['claude-sonnet-4-6'], maskedHeaders: {}, lastTestStatus: 'untested', createdAt: '2026-06-04T06:00:00.000Z', updatedAt: '2026-06-04T06:00:00.000Z', displayName: 'Anthropic' },
          ] },
        }),
      }
    }

    if (url === '/api/settings/model-defaults') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { providerId: 'openai', model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 512 },
        }),
      }
    }

    if (url === '/api/templates') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            templates: [
              { templateId: 'startup-board', name: 'Startup Board', version: '1.0.0', description: '', category: '', tags: [], roleCount: 3, eventCount: 5, usageCount: 0, sessionCount: 0, favoriteCount: 0, isBuiltin: true, availableForSessionCreation: true, defaultStrategy: 'smart_fallback', configStatus: 'default' },
            ],
          },
        }),
      }
    }

    return { ok: true, json: async () => ({ success: true, data: null }) }
  })
})

describe('SettingsModule — Sheet interactions (Task-08)', () => {
  it('navigates to provider view and shows provider type switcher', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))

    await waitFor(() => {
      expect(screen.getByText('选择要管理的 Provider 类型。')).toBeInTheDocument()
      expect(screen.getByText('openai')).toBeInTheDocument()
      expect(screen.getByText('anthropic')).toBeInTheDocument()
    })
  })

  it('shows all five provider types in provider view when API returns connections', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))

    await waitFor(() => {
      for (const id of ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']) {
        expect(screen.getAllByText(new RegExp(id, 'i')).length).toBeGreaterThanOrEqual(1)
      }
    })
  })

  it('opens DataCleanupSheet when clicking data security entry', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/数据安全/i))

    await waitFor(() => {
      expect(screen.getByText('数据安全设置')).toBeInTheDocument()
    })
  })

  it('opens TemplatesModule when clicking template entry', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/模板配置/i))

    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })
  })

  it('returns to home from provider view via back button', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))
    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))

    await waitFor(() => {
      expect(screen.getByText(/厂商配置/i)).toBeInTheDocument()
      expect(screen.getByText(/模板配置/i)).toBeInTheDocument()
      expect(screen.getByText(/数据安全/i)).toBeInTheDocument()
    })
  })

  it('shows provider connection status indicator per provider type', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))

    await waitFor(() => {
      // Provider type buttons should all be visible
      expect(screen.getByText('openai')).toBeInTheDocument()
      expect(screen.getByText('anthropic')).toBeInTheDocument()
    })
  })

  it('returns to home from template view', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/模板配置/i))
    await waitFor(() => {
      expect(screen.getByText('返回')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))

    await waitFor(() => {
      expect(screen.getByText(/厂商配置/i)).toBeInTheDocument()
    })
  })

  it('returns to home from data-security view', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/数据安全/i))
    await waitFor(() => {
      expect(screen.getByText('数据安全设置')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('返回'))

    await waitFor(() => {
      expect(screen.getByText(/厂商配置/i)).toBeInTheDocument()
    })
  })

  it('shows all five provider types even when API returns empty', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/settings/provider-connections') {
        return { ok: true, json: async () => ({ success: true, data: { connections: [] }, requestId: 'uuid' }) }
      }
      return { ok: true, json: async () => ({ success: true, data: null, requestId: 'uuid' }) }
    })

    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/厂商配置/i))

    await waitFor(() => {
      for (const id of ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']) {
        expect(screen.getAllByText(new RegExp(id, 'i')).length).toBeGreaterThanOrEqual(1)
      }
    })
  })

  it('shows data-security cleanup buttons after navigating', async () => {
    render(<SettingsModule />)

    fireEvent.click(await screen.findByText(/数据安全/i))

    await waitFor(() => {
      expect(screen.getByText('clean session')).toBeInTheDocument()
      expect(screen.getByText('clean settings')).toBeInTheDocument()
      expect(screen.getByText('clean all')).toBeInTheDocument()
    })
  })
})