import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionsModule } from '@/modules/sessions'

const mockRouterPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const sessionListResponse = {
  success: true,
  data: {
    sessions: [
      {
        sessionId: 's1',
        topic: '测试会话1',
        status: 'running',
        template: {
          templateId: 'startup-board',
          name: '创业公司董事会',
          version: '1.0.0',
          fromSnapshot: true,
        },
        modelStrategy: {
          modelStrategyId: 'smart',
          name: '智能平衡',
          fromSnapshot: true,
        },
        roleCount: 4,
        eventCount: 2,
        messageCount: 8,
        createdAt: 1717200000000,
        updatedAt: 1717203600000,
      },
      {
        sessionId: 's2',
        topic: '测试会话2',
        status: 'archived',
        template: {
          templateId: 'product-debate',
          name: '产品辩论桌',
          fromSnapshot: false,
          fallbackReason: 'legacy session',
        },
        roleCount: 3,
        eventCount: 1,
        messageCount: 5,
        createdAt: 1717100000000,
        updatedAt: 1717103600000,
      },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.startsWith('/api/sessions?')) {
      return { json: async () => sessionListResponse }
    }

    if (url === '/api/sessions/s2/status') {
      return { json: async () => ({ success: true, data: null }) }
    }

    throw new Error(`Unexpected fetch: ${url}`)
  })
})

describe('Task-11: SessionsModule', () => {
  it('loads SessionListResult and renders template snapshot summary fields', async () => {
    render(<SessionsModule />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/sessions?status=running')
    })

    expect(screen.getByText('创业公司董事会')).toBeInTheDocument()
    expect(screen.getByText('4 角色 · 2 事件 · 8 消息')).toBeInTheDocument()
    expect(screen.getByText('智能平衡')).toBeInTheDocument()
  })

  it('shows fallback text for legacy sessions without snapshots', async () => {
    render(<SessionsModule />)

    fireEvent.click(screen.getByRole('button', { name: '已归档' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/sessions?status=archived')
    })

    expect(screen.getByText('产品辩论桌')).toBeInTheDocument()
    expect(screen.getByText('使用兜底模板信息恢复')).toBeInTheDocument()
  })

  it('navigates to the discussion page using sessionId from SessionListItem', async () => {
    render(<SessionsModule />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /测试会话1/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /测试会话1/ }))

    expect(mockRouterPush).toHaveBeenCalledWith('/discussion/s1')
  })

  it('renders archive and resume actions from session lifecycle state', async () => {
    render(<SessionsModule />)

    await waitFor(() => {
      expect(screen.getByText('归档')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: '已归档' }))

    await waitFor(() => {
      expect(screen.getByText('恢复')).toBeInTheDocument()
    })
  })
})
