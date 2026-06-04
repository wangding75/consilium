import { describe, it, expect } from 'vitest'
import type {
  EventType,
  EventTrigger,
  EventStatus,
  EventRecord,
  VoteRecord,
  SlapPayload,
  CampPayload,
  VotePayload,
  ReversePayload,
  VoteOption,
  EventDetectionResult,
  HostMessageKind,
  DirectorInput,
  Session,
  DiscussionMessage,
} from '@/types'
import type {
  CreateEventRequest,
  VoteRequest,
  EventListResult,
  CreateEventResult,
  VoteResult,
  SendMessageResult,
} from '@/types/api'

describe('EventType enum values', () => {
  it('accepts slap as EventType', () => {
    const t: EventType = 'slap'
    expect(t).toBe('slap')
  })

  it('accepts camp as EventType', () => {
    const t: EventType = 'camp'
    expect(t).toBe('camp')
  })

  it('accepts vote as EventType', () => {
    const t: EventType = 'vote'
    expect(t).toBe('vote')
  })

  it('accepts reverse as EventType', () => {
    const t: EventType = 'reverse'
    expect(t).toBe('reverse')
  })
})

describe('EventTrigger and EventStatus values', () => {
  it('accepts auto and manual as EventTrigger', () => {
    const auto: EventTrigger = 'auto'
    const manual: EventTrigger = 'manual'
    expect(auto).toBe('auto')
    expect(manual).toBe('manual')
  })

  it('accepts active and closed as EventStatus', () => {
    const active: EventStatus = 'active'
    const closed: EventStatus = 'closed'
    expect(active).toBe('active')
    expect(closed).toBe('closed')
  })
})

describe('EventRecord shape', () => {
  it('has all required fields', () => {
    const record: EventRecord = {
      eventId: 'evt-001',
      sessionId: 's1',
      eventType: 'vote',
      trigger: 'manual',
      status: 'active',
      title: '是否迁都',
      description: '讨论迁都问题',
      reason: '用户手动触发',
      payload: { question: '迁哪里', options: [], tally: {} } as VotePayload,
      relatedMessageId: 'msg-001',
      createdAt: '2026-06-01T00:00:00Z',
    }
    expect(record.eventId).toBe('evt-001')
    expect(record.sessionId).toBe('s1')
    expect(record.directorConsumedAt).toBeUndefined()
  })

  it('allows optional directorConsumedAt', () => {
    const record: EventRecord = {
      eventId: 'evt-002',
      sessionId: 's1',
      eventType: 'slap',
      trigger: 'auto',
      status: 'closed',
      title: '打脸',
      description: '关羽被反驳',
      reason: '检测到反驳信号',
      payload: { refuter: 'zgl', refuted: 'gy', refutedView: '北伐', reason: '兵力不足' } as SlapPayload,
      relatedMessageId: 'msg-002',
      directorConsumedAt: '2026-06-01T01:00:00Z',
      createdAt: '2026-06-01T00:00:00Z',
    }
    expect(record.directorConsumedAt).toBe('2026-06-01T01:00:00Z')
  })
})

describe('VoteRecord shape', () => {
  it('has all required fields with user voterType', () => {
    const record: VoteRecord = {
      voteId: 'vote-001',
      sessionId: 's1',
      eventId: 'evt-001',
      voterType: 'user',
      voterId: 'current-user',
      optionId: 'opt1',
      createdAt: '2026-06-01T00:00:00Z',
    }
    expect(record.voteId).toBe('vote-001')
    expect(record.voterType).toBe('user')
  })

  it('supports role voterType', () => {
    const record: VoteRecord = {
      voteId: 'vote-002',
      sessionId: 's1',
      eventId: 'evt-001',
      voterType: 'role',
      voterId: 'zgl',
      optionId: 'opt2',
      createdAt: '2026-06-01T00:00:00Z',
    }
    expect(record.voterType).toBe('role')
  })
})

describe('SlapPayload shape', () => {
  it('has required fields refuter/refuted/refutedView/reason', () => {
    const p: SlapPayload = { refuter: 'zgl', refuted: 'gy', refutedView: '北伐可行', reason: '兵力不足' }
    expect(p.refuter).toBe('zgl')
    expect(p.refuted).toBe('gy')
    expect(p.refutedView).toBe('北伐可行')
    expect(p.reason).toBe('兵力不足')
  })
})

describe('CampPayload shape', () => {
  it('has camps array with name/roleIds/stance', () => {
    const p: CampPayload = {
      camps: [
        { name: '主战', roleIds: ['gy', 'zf'], stance: '主张北伐' },
        { name: '主和', roleIds: ['simayi'], stance: '反对北伐' },
      ],
    }
    expect(p.camps).toHaveLength(2)
    expect(p.camps[0].roleIds).toContain('gy')
    expect(p.camps[1].stance).toBe('反对北伐')
  })
})

describe('VotePayload shape', () => {
  it('has question, options array, and tally record', () => {
    const opt: VoteOption = { id: 'opt1', label: '许昌', roles: ['zgl'] }
    const p: VotePayload = { question: '迁都何处', options: [opt], tally: { opt1: 0 } }
    expect(p.tally['opt1']).toBe(0)
    expect(p.options[0].roles).toContain('zgl')
  })

  it('tally does not include count in options', () => {
    const opt: VoteOption = { id: 'opt1', label: '许昌', roles: [] }
    expect('count' in opt).toBe(false)
  })
})

describe('ReversePayload shape', () => {
  it('has premise, newVariable, impact', () => {
    const p: ReversePayload = { premise: '曹魏强大', newVariable: '吴蜀联盟', impact: '改变战略格局' }
    expect(p.premise).toBe('曹魏强大')
    expect(p.newVariable).toBe('吴蜀联盟')
    expect(p.impact).toBe('改变战略格局')
  })
})

describe('EventDetectionResult shape', () => {
  it('supports not-triggered result with confidence below threshold', () => {
    const r: EventDetectionResult = { eventTriggered: false, confidence: 0.3, reason: '无信号' }
    expect(r.eventTriggered).toBe(false)
    expect(r.eventType).toBeUndefined()
    expect(r.confidence).toBeLessThan(0.6)
  })

  it('supports triggered result with all optional fields', () => {
    const r: EventDetectionResult = {
      eventTriggered: true,
      eventType: 'slap',
      confidence: 0.8,
      reason: '检测到反驳',
      title: '打脸事件',
      description: '关羽观点被反驳',
      payload: { refuter: 'zgl', refuted: 'gy', refutedView: '北伐', reason: '兵力不足' },
      relatedMessageId: 'msg-001',
    }
    expect(r.eventTriggered).toBe(true)
    expect(r.confidence).toBeGreaterThanOrEqual(0.6)
    expect(r.relatedMessageId).toBe('msg-001')
  })
})

describe('CreateEventRequest shape', () => {
  it('has eventType, title, description, payload', () => {
    const req: CreateEventRequest = {
      eventType: 'vote',
      title: '投票',
      description: '请投票',
      payload: { question: '？', options: [], tally: {} },
    }
    expect(req.eventType).toBe('vote')
    expect(req.title).toBe('投票')
  })
})

describe('VoteRequest shape', () => {
  it('has optionId field', () => {
    const req: VoteRequest = { optionId: 'opt1' }
    expect(req.optionId).toBe('opt1')
  })
})

describe('EventListResult shape', () => {
  it('has sessionId, events array, votes array', () => {
    const result: EventListResult = { sessionId: 's1', events: [], votes: [] }
    expect(result.sessionId).toBe('s1')
    expect(Array.isArray(result.events)).toBe(true)
    expect(Array.isArray(result.votes)).toBe(true)
  })
})

describe('CreateEventResult shape', () => {
  it('has event and message fields', () => {
    const mockEvent = {} as EventRecord
    const mockMsg = {} as DiscussionMessage
    const result: CreateEventResult = { event: mockEvent, message: mockMsg }
    expect(result.event).toBeDefined()
    expect(result.message).toBeDefined()
  })
})

describe('VoteResult shape', () => {
  it('has vote and event fields', () => {
    const result: VoteResult = { vote: {} as VoteRecord, event: {} as EventRecord }
    expect(result.vote).toBeDefined()
    expect(result.event).toBeDefined()
  })
})

describe('SendMessageResult event extension fields', () => {
  it('supports optional createdEvents and eventMessages', () => {
    const result: SendMessageResult = {
      sessionId: 's1',
      runId: 'run-001',
      userMessage: null,
      agentMessages: [],
      activeSpeakerId: null,
      createdEvents: [],
      eventMessages: [],
    }
    expect(result.createdEvents).toHaveLength(0)
    expect(result.eventMessages).toHaveLength(0)
  })
})

describe('HostMessageKind includes event value', () => {
  it('event is a valid HostMessageKind', () => {
    const kind: HostMessageKind = 'event'
    expect(kind).toBe('event')
  })
})

describe('DirectorInput.recentEvents field', () => {
  it('accepts optional recentEvents array', () => {
    const input: DirectorInput = {
      session: {} as Session,
      messages: [],
      roles: [],
      trigger: 'auto',
      recentEvents: [],
    }
    expect(Array.isArray(input.recentEvents)).toBe(true)
  })
})
