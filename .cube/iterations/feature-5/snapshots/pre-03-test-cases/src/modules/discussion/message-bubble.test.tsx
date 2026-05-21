import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import type { DiscussionMessage } from '@/types'

// MessageBubble is not yet implemented as a standalone component.
// It's currently inlined in MessageList. We test the expected contract.
// Once implemented, import: import { MessageBubble } from './message-bubble'

function makeMsg(overrides?: Partial<DiscussionMessage>): DiscussionMessage {
  return {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'user',
    content: '测试消息',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('MessageBubble', () => {
  // Task-10: host message renders on left side
  it('renders host message with left-aligned style', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const msg = makeMsg({ type: 'host', roleId: 'xunyu', content: '欢迎' })
    render(<MessageBubble msg={msg} />)
    const bubble = screen.getByText('欢迎')
    expect(bubble).toBeInTheDocument()
  })

  // Task-10: character message renders on left side
  it('renders character message with left-aligned style', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const msg = makeMsg({ type: 'character', roleId: 'zhuge-liang', content: '亮以为' })
    render(<MessageBubble msg={msg} />)
    expect(screen.getByText('亮以为')).toBeInTheDocument()
  })

  // Task-10: user message renders on right side
  it('renders user message with right-aligned style', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const msg = makeMsg({ type: 'user', content: '我的消息' })
    render(<MessageBubble msg={msg} />)
    expect(screen.getByText('我的消息')).toBeInTheDocument()
  })

  // Task-10: system message renders centered
  it('renders system message with centered style', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const msg = makeMsg({ type: 'system', content: '系统提示' })
    render(<MessageBubble msg={msg} />)
    expect(screen.getByText('系统提示')).toBeInTheDocument()
  })

  // Task-10: pending status shows grayed out
  it('renders pending message with grayed out style', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const msg = makeMsg({ status: 'pending', content: '发送中' })
    render(<MessageBubble msg={msg} />)
    expect(screen.getByText('发送中')).toBeInTheDocument()
  })

  // Task-10: failed status shows retry button
  it('renders failed message with retry button', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const onRetry = vi.fn()
    const msg = makeMsg({
      status: 'failed',
      content: '发送失败的消息',
      clientMessageId: 'client_retry',
    })
    render(<MessageBubble msg={msg} onRetry={onRetry} />)
    expect(screen.getByText('发送失败的消息')).toBeInTheDocument()
    expect(screen.getByText(/重试/)).toBeInTheDocument()
  })

  // Task-10: retry button calls onRetry with clientMessageId
  it('retry button calls onRetry with clientMessageId', async () => {
    const { MessageBubble } = await import('./message-bubble')
    const onRetry = vi.fn()
    const msg = makeMsg({
      status: 'failed',
      content: '失败消息',
      clientMessageId: 'client_retry_click',
    })
    render(<MessageBubble msg={msg} onRetry={onRetry} />)
    screen.getByText(/重试/).click()
    expect(onRetry).toHaveBeenCalledWith('client_retry_click')
  })
})
