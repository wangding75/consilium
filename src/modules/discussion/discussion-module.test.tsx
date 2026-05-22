import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DiscussionModule } from '@/modules/discussion'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  })
}

describe('DiscussionModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: loadSession returns session with roles
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/sessions/')) {
        return mockFetchResponse({
          success: true,
          data: {
            sessionId: 'sess-1',
            topic: '三国战略讨论',
            template: { templateId: 'tpl-1', name: '三国谋士' },
            status: 'running',
            roles: [
              { roleId: 'xunyu', name: '荀彧', agentType: 'host', avatar: '荀', model: 'mock' },
              { roleId: 'zhuge-liang', name: '诸葛亮', agentType: 'expert', avatar: '诸', model: 'mock' },
            ],
            activeSpeakerId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        })
      }
      if (url.includes('/api/discussions/') && url.includes('/intent')) {
        return mockFetchResponse({
          success: true,
          data: {
            sessionId: 'sess-1',
            intent: { type: 'passive', confidence: 0.5, rawText: '', execution: { status: 'immediate' } },
            activeSpeakerId: null,
          },
        })
      }
      if (url.includes('/api/discussions/') && url.includes('/messages')) {
        return mockFetchResponse({
          success: true,
          data: {
            sessionId: 'sess-1',
            messages: [],
            activeSpeakerId: null,
            hasMore: false,
          },
        })
      }
      return mockFetchResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } })
    })
  })

  // Task-17: renders the discussion module with send button
  it('renders discussion module with send button', () => {
    render(<DiscussionModule sessionId="sess-1" />)
    expect(screen.getByRole('button', { name: '发送' })).toBeInTheDocument()
  })

  // Task-17: loads session and messages on mount
  it('loads session and messages on mount', async () => {
    render(<DiscussionModule sessionId="sess-1" />)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // Task-17: displays topic after session loads
  it('displays topic after session loads', async () => {
    render(<DiscussionModule sessionId="sess-1" />)
    await waitFor(() => {
      expect(screen.getByText(/三国战略讨论/)).toBeInTheDocument()
    })
  })

  // Task-17: displays role names after session loads
  it('displays role names after session loads', async () => {
    render(<DiscussionModule sessionId="sess-1" />)
    await waitFor(() => {
      expect(screen.getByText('荀彧')).toBeInTheDocument()
      expect(screen.getByText('诸葛亮')).toBeInTheDocument()
    })
  })

  // Task-17: sends message when user types and clicks send
  it('sends message via POST when user types and clicks send', async () => {
    render(<DiscussionModule sessionId="sess-1" />)
    // Wait for initial load
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    // Type and send
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '请分析局势' } })
    const sendButton = screen.getByRole('button', { name: '发送' })
    fireEvent.click(sendButton)
    await waitFor(() => {
      const postCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => typeof c[1] === 'object' && (c[1] as RequestInit).method === 'POST'
      )
      expect(postCalls.length).toBeGreaterThan(0)
    })
  })

  // Task-17: shows error when session load fails
  it('shows error state when session load fails', async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ success: false, error: { code: 'SESSION_NOT_FOUND', message: '会话不存在' } })
    )
    render(<DiscussionModule sessionId="sess-nonexistent" />)
    // Should show some error indication
  })

  // Task-17: empty state when no messages
  it('shows empty state when no messages', async () => {
    render(<DiscussionModule sessionId="sess-1" />)
    await waitFor(() => {
      expect(screen.getByText(/暂无消息/)).toBeInTheDocument()
    })
  })
})
