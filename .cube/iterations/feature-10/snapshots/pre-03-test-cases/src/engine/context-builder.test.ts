import { describe, it, expect } from 'vitest'
import { ContextBuilder } from './context-builder'
import type { ContextBuilderInput, AgentProfile, DiscussionMessage } from '@/types'

function makeProfile(overrides?: Partial<AgentProfile>): AgentProfile {
  return {
    agentId: 'role-host',
    roleId: 'role-host',
    agentType: 'host',
    name: '荀彧',
    persona: '智慧的主持人',
    systemPrompt: '你是荀彧，负责主持讨论。',
    model: 'mock-default',
    visible: true,
    ...overrides,
  }
}

function makeMessage(overrides?: Partial<DiscussionMessage>): DiscussionMessage {
  return {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'user',
    content: '请讨论战略问题',
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeInput(overrides?: Partial<ContextBuilderInput>): ContextBuilderInput {
  return {
    sessionId: 'sess-1',
    topic: '三国战略分析',
    templateName: '三国模板',
    role: makeProfile(),
    messageHistory: [],
    ...overrides,
  }
}

describe('ContextBuilder', () => {
  it('first message is system message containing role systemPrompt', () => {
    const builder = new ContextBuilder()
    const input = makeInput({ role: makeProfile({ systemPrompt: '你是荀彧，主持讨论。' }) })
    const messages = builder.build(input)
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('你是荀彧，主持讨论。')
  })

  it('system message contains topic and templateName', () => {
    const builder = new ContextBuilder()
    const input = makeInput({ topic: '赤壁之战', templateName: '三国模板' })
    const messages = builder.build(input)
    expect(messages[0].content).toContain('赤壁之战')
    expect(messages[0].content).toContain('三国模板')
  })

  it('message history is appended after system message', () => {
    const builder = new ContextBuilder()
    const history: DiscussionMessage[] = [
      makeMessage({ content: '第一条', type: 'user' }),
      makeMessage({ messageId: 'msg-2', content: '第二条', type: 'host' }),
    ]
    const input = makeInput({ messageHistory: history })
    const messages = builder.build(input)
    expect(messages.length).toBeGreaterThan(2)
    const contents = messages.map((m) => m.content)
    expect(contents).toContain('第一条')
    expect(contents).toContain('第二条')
  })

  it('truncates to maxMessages when history exceeds limit', () => {
    const builder = new ContextBuilder()
    const history: DiscussionMessage[] = Array.from({ length: 30 }, (_, i) =>
      makeMessage({ messageId: `msg-${i}`, content: `消息${i}` })
    )
    const input = makeInput({ messageHistory: history, maxMessages: 5 })
    const messages = builder.build(input)
    // 1 system + at most 5 history = 6
    expect(messages.length).toBeLessThanOrEqual(6)
  })

  it('keeps only most recent messages when truncating', () => {
    const builder = new ContextBuilder()
    const history: DiscussionMessage[] = Array.from({ length: 10 }, (_, i) =>
      makeMessage({ messageId: `msg-${i}`, content: `消息${i}` })
    )
    const input = makeInput({ messageHistory: history, maxMessages: 3 })
    const messages = builder.build(input)
    // Latest 3 messages should be msg-7, msg-8, msg-9
    const contents = messages.map((m) => m.content)
    expect(contents).toContain('消息9')
    expect(contents).toContain('消息8')
    expect(contents).not.toContain('消息0')
  })

  it('returns empty history section when messageHistory is empty', () => {
    const builder = new ContextBuilder()
    const input = makeInput({ messageHistory: [] })
    const messages = builder.build(input)
    // Should have at least the system message
    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages[0].role).toBe('system')
  })

  it('maps host/character messages to assistant role in LLM context', () => {
    const builder = new ContextBuilder()
    const history: DiscussionMessage[] = [
      makeMessage({ type: 'host', content: '开场白' }),
      makeMessage({ messageId: 'msg-2', type: 'user', content: '用户提问' }),
    ]
    const input = makeInput({ messageHistory: history })
    const messages = builder.build(input)
    const roles = messages.slice(1).map((m) => m.role)
    expect(roles).toContain('assistant')
    expect(roles).toContain('user')
  })
})
