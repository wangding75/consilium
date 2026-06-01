import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DiscussionModule } from '@/modules/discussion'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response)
}

function makeSession(status: 'running' | 'completed' | 'archived' = 'running') {
  return {
    sessionId: 'sess-1',
    topic: '三国战略讨论',
    template: { templateId: 'three-kingdoms-advisors', name: '三国谋士' },
    status,
    roles: [
      { roleId: 'xunyu', name: '荀彧', agentType: 'host', avatar: '荀', model: 'mock' },
      { roleId: 'zhuge-liang', name: '诸葛亮', agentType: 'expert', avatar: '诸', model: 'mock' },
    ],
    activeSpeakerId: 'xunyu',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('Discussion session operability gate — Task-06', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables composer and shortcut commands for completed sessions', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/')) return mockFetchResponse({ success: true, data: makeSession('completed') })
      if (url.includes('/messages')) return mockFetchResponse({ success: true, data: { sessionId: 'sess-1', messages: [], activeSpeakerId: null, hasMore: false } })
      return mockFetchResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } })
    })

    render(<DiscussionModule sessionId="sess-1" />)

    await waitFor(() => expect(screen.getByText(/当前会话不可继续操作或需要恢复/)).toBeInTheDocument())
    expect(screen.getByRole('textbox')).toBeDisabled()
    expect(screen.getByRole('button', { name: /总结/ })).toBeDisabled()
  })
})
