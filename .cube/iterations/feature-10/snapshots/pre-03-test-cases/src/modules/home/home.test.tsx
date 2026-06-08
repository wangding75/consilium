import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeModule } from '@/modules/home'

const mockRouterPush = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => currentSearchParams,
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const templateListResponse = {
  success: true,
  data: {
    templates: [
      {
        templateId: 'startup-board',
        version: '1.0.0',
        name: '创业公司董事会',
        description: '模拟创业公司董事会讨论',
        category: 'business',
        tags: ['startup'],
        roleCount: 4,
        eventCount: 2,
        usageCount: 10,
        sessionCount: 5,
        favoriteCount: 2,
        isBuiltin: true,
        availableForSessionCreation: true,
      },
      {
        templateId: 'product-debate',
        version: '1.0.0',
        name: '产品辩论桌',
        description: '模拟产品方向辩论',
        category: 'product',
        tags: ['debate'],
        roleCount: 3,
        eventCount: 1,
        usageCount: 6,
        sessionCount: 4,
        favoriteCount: 1,
        isBuiltin: true,
        availableForSessionCreation: true,
      },
    ],
  },
}

const strategiesResponse = {
  success: true,
  data: {
    strategies: [
      {
        modelStrategyId: 'smart',
        name: '智能平衡',
        description: '默认平衡策略',
        priority: ['speed', 'quality'],
        defaultModel: 'claude-3-5-haiku',
        roleOverrides: {},
        fallbackChain: ['mock'],
        temperature: 0.7,
        maxTokens: 512,
        costPolicy: 'balanced',
        speedPolicy: 'balanced',
        active: true,
        isDefault: true,
      },
      {
        modelStrategyId: 'quality',
        name: '质量优先',
        description: '更强模型与更长输出',
        priority: ['quality'],
        defaultModel: 'claude-3-5-sonnet',
        roleOverrides: {},
        fallbackChain: ['claude-3-5-haiku'],
        temperature: 0.5,
        maxTokens: 768,
        costPolicy: 'high-quality',
        speedPolicy: 'slower',
        active: true,
        isDefault: false,
      },
    ],
    defaultModelStrategyId: 'smart',
  },
}

beforeEach(() => {
  currentSearchParams = new URLSearchParams()
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === '/api/templates') {
      return { ok: true, status: 200, json: async () => templateListResponse }
    }

    if (url === '/api/model-strategies') {
      return { ok: true, status: 200, json: async () => strategiesResponse }
    }

    if (url === '/api/sessions/recent') {
      return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) }
    }

    if (url === '/api/sessions') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            sessionId: 'new-session',
            topic: '如何推进董事会决策',
            template: {
              templateId: 'product-debate',
              name: '产品辩论桌',
              version: '1.0.0',
            },
            modelStrategy: {
              modelStrategyId: 'smart',
              name: '智能平衡',
              selectedByDefault: true,
            },
            status: 'running',
            createdAt: 1717200000000,
          },
        }),
      }
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })
})

describe('Task-09: HomeModule', () => {
  it('loads templates and model strategies from APIs on mount', async () => {
    render(<HomeModule />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/templates')
      expect(fetchMock).toHaveBeenCalledWith('/api/model-strategies')
    })
  })

  it('preselects template from query string using fetched template list', async () => {
    currentSearchParams = new URLSearchParams('templateId=product-debate')

    render(<HomeModule />)

    await waitFor(() => {
      expect(screen.getByText('产品辩论桌')).toBeInTheDocument()
    })
  })

  it('submits POST /api/sessions with query-selected templateId and loaded default strategy', async () => {
    currentSearchParams = new URLSearchParams('templateId=product-debate')

    render(<HomeModule />)

    await waitFor(() => {
      expect(screen.getByText('产品辩论桌')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('输入讨论议题...'), {
      target: { value: '如何推进董事会决策' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始讨论' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            topic: '如何推进董事会决策',
            templateId: 'product-debate',
            modelStrategyId: 'smart',
          }),
        })
      )
    })
  })

  it('shows API error from create session and does not navigate', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url === '/api/templates') {
        return { ok: true, status: 200, json: async () => templateListResponse }
      }

      if (url === '/api/model-strategies') {
        return { ok: true, status: 200, json: async () => strategiesResponse }
      }

      if (url === '/api/sessions/recent') {
        return { ok: true, status: 200, json: async () => ({ success: true, data: [] }) }
      }

      if (url === '/api/sessions') {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            success: false,
            error: { code: 'TEMPLATE_UNAVAILABLE', message: '模板不可用' },
            data: null,
          }),
        }
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<HomeModule />)

    fireEvent.change(screen.getByPlaceholderText('输入讨论议题...'), {
      target: { value: '如何推进董事会决策' },
    })
    fireEvent.click(screen.getByRole('button', { name: '开始讨论' }))

    await waitFor(() => {
      expect(screen.getByText('模板不可用')).toBeInTheDocument()
    })

    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
