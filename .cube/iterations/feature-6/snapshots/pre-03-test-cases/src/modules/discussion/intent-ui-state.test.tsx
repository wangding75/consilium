import { type ComponentType, createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { DiscussionModule } from '@/modules/discussion'
import { MessageList } from '@/modules/discussion/message-list'
import type { ApiError } from '@/types/api'
import type { DiscussionMessage, IntentDebugSummary } from '@/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

function mockFetchResponse(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response)
}

function makeSession() {
  return {
    sessionId: 'sess-1',
    topic: '三国战略讨论',
    template: { templateId: 'three-kingdoms-advisors', name: '三国谋士' },
    status: 'running',
    roles: [
      { roleId: 'xunyu', name: '荀彧', agentType: 'host', avatar: '荀', model: 'mock' },
      { roleId: 'zhuge-liang', name: '诸葛亮', agentType: 'expert', avatar: '诸', model: 'mock' },
    ],
    activeSpeakerId: 'xunyu',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeMessage(overrides?: Partial<DiscussionMessage>): DiscussionMessage {
  return {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'user',
    content: '让诸葛亮回应一下',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Discussion intent parsing UI state — Task-08', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockImplementation((url: string, init?: RequestInit) => {
      if (!init && url.includes('/api/sessions/')) return mockFetchResponse({ success: true, data: makeSession() })
      if (!init && url.includes('/messages')) return mockFetchResponse({ success: true, data: { sessionId: 'sess-1', messages: [], activeSpeakerId: 'xunyu', hasMore: false } })
      if (init?.method === 'POST' && url.includes('/intent')) {
        return mockFetchResponse({
          success: true,
          data: {
            sessionId: 'sess-1',
            clientMessageId: 'client-1',
            activeSpeakerId: 'zhuge-liang',
            intent: {
              type: 'command',
              confidence: 0.9,
              rawText: '让诸葛亮回应一下',
              target: { roleId: 'zhuge-liang', action: 'reply' },
              schedulerHint: { preferredSpeakerId: 'zhuge-liang', reason: 'direct mention' },
              execution: { status: 'immediate' },
            },
          },
        })
      }
      if (init?.method === 'POST' && url.includes('/messages')) {
        return mockFetchResponse({ success: true, data: { sessionId: 'sess-1', runId: 'run-1', userMessage: null, agentMessages: [], activeSpeakerId: 'zhuge-liang' } })
      }
      return mockFetchResponse({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } })
    })
  })

  it('calls Intent API before Message API and sends the returned intentResponse', async () => {
    render(<DiscussionModule sessionId="sess-1" />)
    await waitFor(() => {
      expect(mockFetch.mock.calls.some(([url]) => String(url).includes('/api/discussions/sess-1/messages?'))).toBe(true)
    })

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '让诸葛亮回应一下' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => {
      const intentCallIndex = mockFetch.mock.calls.findIndex(([url]) => String(url).includes('/intent'))
      const messageCallIndex = mockFetch.mock.calls.findIndex(([url, init]) => String(url).includes('/messages') && (init as RequestInit | undefined)?.method === 'POST')
      expect(intentCallIndex).toBeGreaterThan(-1)
      expect(messageCallIndex).toBeGreaterThan(intentCallIndex)
      expect(JSON.parse(String((mockFetch.mock.calls[messageCallIndex][1] as RequestInit).body)).intentResponse.sessionId).toBe('sess-1')
    })
  })

  it('renders explicit rewrite and plain-message actions for unrecognizable command errors', () => {
    const intentError: ApiError = { code: 'INTENT_CLASSIFICATION_FAILED', message: '请改写指令或按普通发言继续' }
    const onRewriteCommand = vi.fn()
    const onContinueAsPlainMessage = vi.fn()

    render(
      <MessageList
        messages={[]}
        isLoading={false}
        intentError={intentError}
        onRewriteCommand={onRewriteCommand}
        onContinueAsPlainMessage={onContinueAsPlainMessage}
      />
    )

    fireEvent.click(screen.getByText('改写指令'))
    fireEvent.click(screen.getByText('按普通发言继续'))
    expect(onRewriteCommand).toHaveBeenCalled()
    expect(onContinueAsPlainMessage).toHaveBeenCalled()
  })

  it('displays only safe debug summary fields when debug mode is enabled', () => {
    const debugSummary: IntentDebugSummary = {
      classifierMode: 'rule',
      matchedRule: 'role-name',
      confidence: 0.91,
      type: 'command',
      target: { roleId: 'zhuge-liang', action: 'reply' },
      schedulerHint: { preferredSpeakerId: 'zhuge-liang', reason: 'direct mention' },
    }
    const message = makeMessage({
      metadata: {
        intent: {
          type: 'command',
          confidence: 0.91,
          rawText: '让诸葛亮回应一下',
          target: { roleId: 'zhuge-liang', action: 'reply' },
          schedulerHint: { preferredSpeakerId: 'zhuge-liang', reason: 'direct mention' },
          execution: { status: 'immediate' },
          debugSummary,
        },
      },
    })

    const DebuggableMessageList = MessageList as ComponentType<{
      messages: DiscussionMessage[]
      isLoading: boolean
      debugIntent?: boolean
    }>
    render(createElement(DebuggableMessageList, { messages: [message], isLoading: false, debugIntent: true }))

    expect(screen.getByText(/classifierMode: rule/)).toBeInTheDocument()
    expect(screen.getByText(/matchedRule: role-name/)).toBeInTheDocument()
    expect(screen.queryByText(/Prompt|API Key|provider request/i)).not.toBeInTheDocument()
  })
})
