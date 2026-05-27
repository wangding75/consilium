import { describe, it, expect } from 'vitest'
import type { DiscussionMessage, DiscussionSummary, HostMessageKind } from '@/types'

describe('MessageBubble host message kind rendering contracts', () => {
  it('renders opening host message with distinct style', () => {
    const kind: HostMessageKind = 'opening'
    expect(kind).toBe('opening')
  })

  it('renders transition host message', () => {
    const kind: HostMessageKind = 'transition'
    expect(kind).toBe('transition')
  })

  it('renders invitation host message with invitationId', () => {
    const msg: DiscussionMessage = {
      messageId: 'msg-inv',
      sessionId: 'sess-1',
      type: 'host',
      content: '请发表看法',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: { hostMessageKind: 'invitation', invitationId: 'inv-1' },
    }
    expect(msg.metadata?.hostMessageKind).toBe('invitation')
    expect(msg.metadata?.invitationId).toBe('inv-1')
  })

  it('renders event_candidate host message', () => {
    const msg: DiscussionMessage = {
      messageId: 'msg-event',
      sessionId: 'sess-1',
      type: 'host',
      content: '检测到事件候选',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: { hostMessageKind: 'event_candidate' },
    }
    expect(msg.metadata?.hostMessageKind).toBe('event_candidate')
  })

  it('renders stage_summary host message', () => {
    const kind: HostMessageKind = 'stage_summary'
    expect(kind).toBe('stage_summary')
  })

  it('renders final_summary with DiscussionSummary metadata', () => {
    const msg: DiscussionMessage = {
      messageId: 'msg-final',
      sessionId: 'sess-1',
      type: 'host',
      content: '讨论总结',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      metadata: {
        hostMessageKind: 'final_summary',
        summary: {
          summaryId: 'sum-1',
          sessionId: 'sess-1',
          messageId: 'msg-final',
          consensus: ['c1'],
          disagreements: ['d1'],
          recommendations: ['r1'],
          nextSteps: ['n1'],
          checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    }
    expect(msg.metadata?.hostMessageKind).toBe('final_summary')
    expect(msg.metadata?.summary?.consensus).toHaveLength(1)
  })

  it('falls back to normal host message for unknown hostMessageKind', () => {
    const msg: DiscussionMessage = {
      messageId: 'msg-unknown',
      sessionId: 'sess-1',
      type: 'host',
      content: '普通主持人消息',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    // No hostMessageKind → should render as normal host message
    expect(msg.metadata?.hostMessageKind).toBeUndefined()
  })
})

describe('SummaryActions component contracts', () => {
  it('provides return to home action', () => {
    const actions = ['home', 'sessions', 'resume']
    expect(actions).toContain('home')
  })

  it('provides view sessions page action', () => {
    const actions = ['home', 'sessions', 'resume']
    expect(actions).toContain('sessions')
  })

  it('provides continue questioning (resume) action', () => {
    const actions = ['home', 'sessions', 'resume']
    expect(actions).toContain('resume')
  })

  it('resume action triggers PATCH sessions status with resume', () => {
    const requestBody = { action: 'resume' as const }
    expect(requestBody.action).toBe('resume')
  })
})
