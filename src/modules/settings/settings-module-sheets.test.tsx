import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SettingsModule } from '@/modules/settings'

const mockRouterPush = vi.fn()
const expectedProviderIds = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom'] as const

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}))

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/llm/providers') {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              providerId: 'openai',
              enabled: true,
              baseUrl: 'https://api.openai.com/v1',
              maskedKey: 'sk-***1234',
              modelList: ['gpt-4o'],
              maskedHeaders: {},
              lastTestStatus: 'success',
              lastTestedAt: '2026-06-04T06:00:00.000Z',
            },
            {
              providerId: 'anthropic',
              enabled: true,
              baseUrl: 'https://api.anthropic.com',
              maskedKey: 'sk-***abcd',
              modelList: ['claude-sonnet-4-6'],
              maskedHeaders: {},
              lastTestStatus: 'untested',
            },
          ],
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

    return { ok: true, json: async () => ({ success: true, data: [] }) }
  })
})

describe('SettingsModule — Sheet interactions (Task-08)', () => {
  it('loads provider list and model defaults on mount', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/llm/providers')
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/model-defaults')
    })
  })

  it('opens ProviderSheet when clicking a provider card trigger', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText('openai')).toBeInTheDocument()
    })

    const providerCard = screen.getByText('openai').closest('[class*="border"]')
    expect(providerCard).not.toBeNull()
    fireEvent.click(providerCard as HTMLElement)

    await waitFor(() => {
      expect(screen.getByDisplayValue('openai')).toBeInTheDocument()
    })
  })

  it('opens ModelSheet when clicking the model edit button', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /编辑|edit/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /编辑|edit/i }))

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /provider|厂商/i })).toBeInTheDocument()
    })
  })

  it('opens PromptSheet when clicking the prompt section trigger', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText(/Prompt.*提示词|提示词.*配置/i)).toBeInTheDocument()
    })

    const promptSection = screen.getByText(/Prompt.*提示词|提示词.*配置/i).closest('section')
    expect(promptSection).not.toBeNull()
    fireEvent.click(promptSection as HTMLElement)

    await waitFor(() => {
      expect(screen.getByText(/全局.*prompt|global.*prompt/i)).toBeInTheDocument()
    })
  })

  it('opens DataCleanupSheet when clicking the data and security section trigger', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText(/数据.*安全|Data.*Security/i)).toBeInTheDocument()
    })

    const dataSecuritySection = screen.getByText(/数据.*安全|Data.*Security/i).closest('section')
    expect(dataSecuritySection).not.toBeNull()
    fireEvent.click(dataSecuritySection as HTMLElement)

    await waitFor(() => {
      expect(screen.getByText(/清理.*会话|clean.*session/i)).toBeInTheDocument()
    })
  })

  it('shows updated template placeholder text', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText(/模板管理将在后续迭代中提供|后续迭代/i)).toBeInTheDocument()
    })
  })

  it('shows disabled 了解更多 button in template section', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      const learnMoreButton = screen.getByText(/了解更多|learn.*more/i)
      expect(learnMoreButton).toBeInTheDocument()
      expect(learnMoreButton.closest('button')).toBeDisabled()
    })
  })

  it('shows model priority description in model section', async () => {
    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getByText(/角色专属|优先级|priority/i)).toBeInTheDocument()
    })
  })

  it('shows every supported provider when API returns none', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/llm/providers') {
        return { ok: true, json: async () => ({ success: true, data: [], requestId: 'uuid' }) }
      }
      return { ok: true, json: async () => ({ success: true, data: null, requestId: 'uuid' }) }
    })

    render(<SettingsModule />)

    await waitFor(() => {
      for (const providerId of expectedProviderIds) {
        expect(screen.getByText(new RegExp(providerId, 'i'))).toBeInTheDocument()
      }
    })
  })

  it('shows unconfigured status for providers missing from API response', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url === '/api/llm/providers') {
        return { ok: true, json: async () => ({ success: true, data: [], requestId: 'uuid' }) }
      }
      return { ok: true, json: async () => ({ success: true, data: null, requestId: 'uuid' }) }
    })

    render(<SettingsModule />)

    await waitFor(() => {
      expect(screen.getAllByText(/未配置|点击配置|tap.*to.*config/i).length).toBeGreaterThanOrEqual(3)
    })
  })
})
