import { describe, it, expect } from 'vitest'
import { DefaultDirector } from './director'
import type { DirectorInput, Session, AgentProfile, DiscussionMessage, IntentResult } from '@/types'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1',
    templateId: 'tpl-1',
    topic: '测试议题',
    status: 'running',
    state: { stage: 'opening', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeProfile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    agentId: 'agent-1',
    roleId: 'role-1',
    agentType: 'expert',
    name: '测试角色',
    persona: '测试',
    systemPrompt: 'You are a test role.',
    model: 'mock',
    visible: true,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<DiscussionMessage> = {}): DiscussionMessage {
  return {
    messageId: 'msg-1',
    sessionId: 'sess-1',
    type: 'character',
    content: '测试消息',
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeInput(overrides: Partial<DirectorInput> = {}): DirectorInput {
  return {
    session: makeSession(),
    messages: [],
    roles: [makeProfile()],
    trigger: 'user_message',
    ...overrides,
  }
}

describe('DefaultDirector.decide', () => {
  const director = new DefaultDirector()

  it('returns continue when discussion is in opening stage with few messages', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'opening', turnCount: 2, lastSpeakerId: 'role-1' } }),
      messages: [makeMessage()],
      roles: [makeProfile(), makeProfile({ roleId: 'role-2', agentId: 'agent-2' })],
      trigger: 'user_message',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('continue')
    expect(result.reason).toBeTruthy()
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('returns invite_user when discussion has disagreement signals', async () => {
    const messages: DiscussionMessage[] = [
      makeMessage({ roleId: 'role-1', content: '我认为应该进攻' }),
      makeMessage({ roleId: 'role-2', content: '我反对，应该防守', roleId: 'role-2', messageId: 'msg-2' }),
    ]
    const input = makeInput({
      session: makeSession({ state: { stage: 'developing', turnCount: 6, lastSpeakerId: 'role-2' } }),
      messages,
      roles: [makeProfile(), makeProfile({ roleId: 'role-2', agentId: 'agent-2' })],
      trigger: 'user_message',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('invite_user')
    expect(result.reason).toBeTruthy()
  })

  it('does not create invite_user when pending invitation already exists', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'developing', turnCount: 6, lastSpeakerId: 'role-2' } }),
      messages: [makeMessage()],
      trigger: 'user_message',
      pendingInvitation: {
        invitationId: 'inv-1',
        sessionId: 'sess-1',
        status: 'pending',
        prompt: '请发表看法',
        reason: 'disagreement',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    const result = await director.decide(input)
    expect(result.action).not.toBe('invite_user')
  })

  it('returns trigger_event when discussion has dramatic tension', async () => {
    const messages: DiscussionMessage[] = Array.from({ length: 8 }, (_, i) =>
      makeMessage({ messageId: `msg-${i}`, roleId: i % 2 === 0 ? 'role-1' : 'role-2', content: `观点${i}` })
    )
    const input = makeInput({
      session: makeSession({ state: { stage: 'climax', turnCount: 8, lastSpeakerId: 'role-2' } }),
      messages,
      roles: [makeProfile(), makeProfile({ roleId: 'role-2', agentId: 'agent-2' })],
      trigger: 'user_message',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('trigger_event')
    expect(result.eventCandidate).toBeDefined()
    expect(result.eventCandidate?.type).toBeTruthy()
  })

  it('returns conclude when discussion reaches closing stage', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'closing', turnCount: 12, lastSpeakerId: 'role-1' } }),
      messages: Array.from({ length: 10 }, (_, i) =>
        makeMessage({ messageId: `msg-${i}`, content: `消息${i}` })
      ),
      trigger: 'user_message',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('conclude')
    expect(result.summaryHint).toBeDefined()
  })

  it('returns conclude for summary_request trigger', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'developing', turnCount: 8, lastSpeakerId: 'role-1' } }),
      messages: Array.from({ length: 6 }, (_, i) =>
        makeMessage({ messageId: `msg-${i}`, content: `消息${i}` })
      ),
      trigger: 'summary_request',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('conclude')
  })

  it('returns continue for invitation_skip trigger', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'developing', turnCount: 4, lastSpeakerId: 'role-1' } }),
      messages: [makeMessage()],
      trigger: 'invitation_skip',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('continue')
  })

  it('returns continue for invitation_response trigger', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'developing', turnCount: 4, lastSpeakerId: 'role-1' } }),
      messages: [makeMessage()],
      trigger: 'invitation_response',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('continue')
  })

  it('returns continue when no roles are available', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'opening', turnCount: 0, lastSpeakerId: null } }),
      messages: [],
      roles: [],
      trigger: 'opening',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('continue')
  })

  it('returns valid DirectorDecisionRecord with decisionId and sessionId', async () => {
    const input = makeInput()
    const result = await director.decide(input)
    expect(result.decisionId).toBeTruthy()
    expect(result.sessionId).toBe('sess-1')
    expect(result.createdAt).toBeTruthy()
  })

  it('returns continue when opening trigger with no messages', async () => {
    const input = makeInput({
      session: makeSession({ state: { stage: 'idle', turnCount: 0, lastSpeakerId: null } }),
      messages: [],
      trigger: 'opening',
    })
    const result = await director.decide(input)
    expect(result.action).toBe('continue')
  })

  it('returns stageSuggestion when stage transition is appropriate', async () => {
    const messages: DiscussionMessage[] = Array.from({ length: 6 }, (_, i) =>
      makeMessage({ messageId: `msg-${i}`, content: `开场发言${i}` })
    )
    const input = makeInput({
      session: makeSession({ state: { stage: 'opening', turnCount: 6, lastSpeakerId: 'role-1' } }),
      messages,
      trigger: 'user_message',
    })
    const result = await director.decide(input)
    if (result.stageSuggestion) {
      expect(['developing', 'climax', 'closing']).toContain(result.stageSuggestion)
    }
  })
})
