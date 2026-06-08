import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MessageBubble } from '@/modules/discussion/message-bubble'
import { RoleBar } from '@/modules/discussion/role-bar'
import type { DiscussionMessage } from '@/types'

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

describe('Discussion command message display — Task-09', () => {
  it('renders a command label for command or decide user messages', () => {
    render(<MessageBubble msg={makeMessage({ metadata: { intentLabel: '指令', intent: { type: 'command', confidence: 0.9, rawText: '让诸葛亮回应一下', execution: { status: 'immediate' } } } })} />)

    expect(screen.getByText('指令')).toBeInTheDocument()
    expect(screen.getByText('让诸葛亮回应一下')).toBeInTheDocument()
  })

  it('highlights the role selected by schedulerHint through activeSpeakerId', () => {
    const { container } = render(
      <RoleBar
        roles={[
          { roleId: 'xunyu', name: '荀彧', agentType: 'host', avatar: '荀' },
          { roleId: 'zhuge-liang', name: '诸葛亮', agentType: 'expert', avatar: '诸' },
        ]}
        activeSpeakerId="zhuge-liang"
      />
    )

    const highlighted = screen.getByText('诸葛亮').closest('.flex')?.querySelector('.ring-primary') ?? container.querySelector('.ring-primary')
    expect(highlighted).toBeInTheDocument()
  })
})
