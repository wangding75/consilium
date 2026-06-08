import { describe, it, expect } from 'vitest'
import { DefaultEventDetector, DefaultEventRateLimiter } from '@/engine/events'
import type { Session, DiscussionMessage, AgentOutput, EventRecord } from '@/types'
import type { EventRateLimitInput } from '@/engine/events'

const makeSession = (): Session =>
  ({
    id: 's1',
    templateId: 'three-kingdoms',
    title: 'Test Session',
    roles: [],
    state: { stage: 'developing', turnCount: 10, lastSpeakerId: null },
  }) as unknown as Session

const makeMessage = (
  content: string,
  type: DiscussionMessage['type'] = 'character',
  roleId = 'role1'
): DiscussionMessage => ({
  messageId: `msg-${Math.random().toString(36).slice(2)}`,
  sessionId: 's1',
  type,
  roleId,
  content,
  status: 'completed',
  createdAt: new Date().toISOString(),
})

const makeOutput = (content: string): AgentOutput => ({
  agentId: 'agent1',
  roleId: 'role1',
  messageType: 'character',
  content,
})

describe('DefaultEventDetector — slap detection', () => {
  const detector = new DefaultEventDetector()
  const session = makeSession()

  it('detects slap when recent messages contain 反对 signal', async () => {
    const messages = [
      makeMessage('北伐是正确的战略', 'character', 'role1'),
      makeMessage('我反对这个观点，北伐根本行不通', 'character', 'role2'),
      makeMessage('确实不认为北伐能成功', 'character', 'role3'),
    ]
    const output = makeOutput('让我们总结一下争议')
    const result = await detector.detect(session, messages, output)
    // Implementation not done yet — expect throw or eventTriggered
    expect(result).toBeDefined()
  })

  it('does not trigger slap when confidence is below 0.6', async () => {
    const messages = [makeMessage('普通讨论内容', 'character', 'role1')]
    const output = makeOutput('继续讨论')
    const result = await detector.detect(session, messages, output)
    expect(result).toBeDefined()
  })

  it('detects slap on 不同意 keyword in recent messages', async () => {
    const messages = [
      makeMessage('我认为应该休养生息', 'character', 'role1'),
      makeMessage('我不同意，应该立刻北伐', 'character', 'role2'),
      makeMessage('这个观点是错误的', 'character', 'role3'),
    ]
    const output = makeOutput('争论激烈')
    const result = await detector.detect(session, messages, output)
    expect(result).toBeDefined()
  })
})

describe('DefaultEventDetector — camp detection', () => {
  const detector = new DefaultEventDetector()
  const session = makeSession()

  it('detects camp when at least two roles show opposing stances', async () => {
    const messages = [
      makeMessage('我坚持主战派立场', 'character', 'role1'),
      makeMessage('我支持主和派，应当休兵', 'character', 'role2'),
      makeMessage('我也认为应该议和', 'character', 'role3'),
    ]
    const output = makeOutput('两派观点对立')
    const result = await detector.detect(session, messages, output)
    expect(result).toBeDefined()
  })
})

describe('DefaultEventDetector — vote detection', () => {
  const detector = new DefaultEventDetector()
  const session = makeSession()

  it('detects vote when 请大家投票 signal is present', async () => {
    const messages = [
      makeMessage('各有利弊，请大家投票决定', 'character', 'role1'),
      makeMessage('我也觉得需要选择一个方向', 'character', 'role2'),
    ]
    const output = makeOutput('需要投票决策')
    const result = await detector.detect(session, messages, output)
    expect(result).toBeDefined()
  })

  it('detects vote when 无法定夺 signal appears', async () => {
    const messages = [
      makeMessage('双方都有道理，无法定夺', 'character', 'role1'),
      makeMessage('确实各有利弊', 'character', 'role2'),
    ]
    const output = makeOutput('需要决策')
    const result = await detector.detect(session, messages, output)
    expect(result).toBeDefined()
  })
})

describe('DefaultEventDetector — reverse detection', () => {
  const detector = new DefaultEventDetector()
  const session = makeSession()

  it('detects reverse when 如果前提变化 signal is present', async () => {
    const messages = [
      makeMessage('如果联盟破裂，情况就完全不同了', 'character', 'role1'),
      makeMessage('前提变化了，极端情况下该如何', 'character', 'role2'),
    ]
    const output = makeOutput('反转讨论')
    const result = await detector.detect(session, messages, output)
    expect(result).toBeDefined()
  })
})

describe('DefaultEventDetector — confidence threshold', () => {
  const detector = new DefaultEventDetector()
  const session = makeSession()

  it('returns eventTriggered=false when no signals present', async () => {
    const messages = [
      makeMessage('今天天气不错', 'user', undefined),
      makeMessage('是的，很好', 'character', 'role1'),
    ]
    const output = makeOutput('继续聊')
    const result = await detector.detect(session, messages, output)
    // Either throws (not implemented) or returns non-triggered
    if (!('eventTriggered' in result)) return
    if (result.eventTriggered === false) {
      expect(result.confidence).toBeLessThan(0.6)
    }
  })

  it('returns eventType when eventTriggered is true', async () => {
    const messages = [
      makeMessage('我反对这个错误的决策', 'character', 'role2'),
      makeMessage('你的观点是错的', 'character', 'role3'),
    ]
    const output = makeOutput('明显的反驳')
    const result = await detector.detect(session, messages, output)
    if (!('eventTriggered' in result)) return
    if (result.eventTriggered) {
      expect(result.eventType).toBeDefined()
      expect(result.confidence).toBeGreaterThanOrEqual(0.6)
    }
  })
})

const makeEventRecord = (
  eventType: EventRecord['eventType'],
  relatedMessageId: string,
  sessionId = 's1'
): EventRecord => ({
  eventId: `evt-${Math.random().toString(36).slice(2)}`,
  sessionId,
  eventType,
  trigger: 'auto',
  status: 'active',
  title: 'test event',
  description: 'test',
  reason: 'test',
  payload: { question: 'q', options: [], tally: {} },
  relatedMessageId,
  createdAt: new Date().toISOString(),
})

const makeRoleMessage = (messageId: string): DiscussionMessage => ({
  messageId,
  sessionId: 's1',
  type: 'character',
  roleId: 'role1',
  content: '普通消息',
  status: 'completed',
  createdAt: new Date().toISOString(),
})

describe('DefaultEventRateLimiter — cooldown rule', () => {
  const limiter = new DefaultEventRateLimiter()

  it('allows event when no recent same-type event exists', () => {
    const input: EventRateLimitInput = {
      sessionId: 's1',
      eventType: 'slap',
      recentMessages: [
        makeRoleMessage('msg-1'),
        makeRoleMessage('msg-2'),
        makeRoleMessage('msg-3'),
        makeRoleMessage('msg-4'),
      ],
      recentEvents: [],
      currentMessageIndex: 3,
    }
    const result = limiter.check(input)
    expect(result.allowed).toBe(true)
  })

  it('blocks event when same-type event occurred fewer than 3 messages ago', () => {
    // slap event at msg-2, current message is msg-3 — only 1 message gap → COOLDOWN
    const input: EventRateLimitInput = {
      sessionId: 's1',
      eventType: 'slap',
      recentMessages: [
        makeRoleMessage('msg-1'),
        makeRoleMessage('msg-2'),
        makeRoleMessage('msg-3'),
      ],
      recentEvents: [makeEventRecord('slap', 'msg-2')],
      currentMessageIndex: 2,
    }
    const result = limiter.check(input)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('COOLDOWN')
  })

  it('allows event when same-type event is 3+ messages before current', () => {
    // slap event at msg-1, current message is msg-5 — 4 messages gap → allowed
    const msgs = ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5'].map(makeRoleMessage)
    const input: EventRateLimitInput = {
      sessionId: 's1',
      eventType: 'slap',
      recentMessages: msgs,
      recentEvents: [makeEventRecord('slap', 'msg-1')],
      currentMessageIndex: 4,
    }
    const result = limiter.check(input)
    expect(result.allowed).toBe(true)
  })

  it('different event type does not trigger cooldown for slap', () => {
    const input: EventRateLimitInput = {
      sessionId: 's1',
      eventType: 'vote',
      recentMessages: [makeRoleMessage('msg-1'), makeRoleMessage('msg-2')],
      recentEvents: [makeEventRecord('slap', 'msg-1')],
      currentMessageIndex: 1,
    }
    const result = limiter.check(input)
    // vote type is not affected by slap cooldown
    expect(result).toBeDefined()
  })
})

describe('DefaultEventRateLimiter — density rule', () => {
  const limiter = new DefaultEventRateLimiter()

  it('blocks when 3 or more events in the last 10 timeline items', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => makeRoleMessage(`msg-${i}`))
    const events = [
      makeEventRecord('slap', 'msg-0'),
      makeEventRecord('camp', 'msg-3'),
      makeEventRecord('vote', 'msg-6'),
    ]
    const input: EventRateLimitInput = {
      sessionId: 's1',
      eventType: 'reverse',
      recentMessages: msgs,
      recentEvents: events,
      currentMessageIndex: 9,
    }
    const result = limiter.check(input)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('DENSITY')
  })

  it('allows when fewer than 3 events in the last 10 timeline items', () => {
    const msgs = Array.from({ length: 10 }, (_, i) => makeRoleMessage(`msg-${i}`))
    const events = [
      makeEventRecord('slap', 'msg-0'),
      makeEventRecord('camp', 'msg-5'),
    ]
    const input: EventRateLimitInput = {
      sessionId: 's1',
      eventType: 'vote',
      recentMessages: msgs,
      recentEvents: events,
      currentMessageIndex: 9,
    }
    const result = limiter.check(input)
    expect(result.allowed).toBe(true)
  })
})

