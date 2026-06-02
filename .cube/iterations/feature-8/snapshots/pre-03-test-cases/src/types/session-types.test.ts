import type { DiscussionStage, Session } from '@/types'
import type { CreateSessionParams, CreateSessionResult } from '@/types/api'

it('DiscussionStage union includes idle', () => {
  const stage: DiscussionStage = 'idle'
  expect(stage).toBe('idle')
})

it('Session shape includes status field as required', () => {
  const session: Session = {
    id: 's1',
    templateId: 't1',
    topic: '测试',
    status: 'active',
    state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  expect(session.status).toBe('active')
  expect(session.state.stage).toBe('idle')
})

it('Session status accepts completed and archived values', () => {
  const s1: Session['status'] = 'completed'
  const s2: Session['status'] = 'archived'
  expect(s1).toBe('completed')
  expect(s2).toBe('archived')
})

it('Session modelStrategyId is optional', () => {
  const session: Session = {
    id: 's1',
    templateId: 't1',
    topic: '测试',
    status: 'active',
    state: { stage: 'opening', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  expect(session.modelStrategyId).toBeUndefined()
})

it('CreateSessionParams has topic templateId and optional modelStrategyId', () => {
  const params: CreateSessionParams = {
    topic: '如何提高团队效率',
    templateId: 'three-kingdoms-advisors',
  }
  expect(params.topic).toBe('如何提高团队效率')
  expect(params.templateId).toBe('three-kingdoms-advisors')
  expect(params.modelStrategyId).toBeUndefined()
})

it('CreateSessionResult has sessionId topic template status createdAt', () => {
  const result: CreateSessionResult = {
    sessionId: 'uuid-123',
    topic: '如何提高团队效率',
    template: { id: 'three-kingdoms-advisors', name: '三国军师团' },
    status: 'active',
    createdAt: 1234567890000,
  }
  expect(result.sessionId).toBe('uuid-123')
  expect(result.status).toBe('active')
  expect(result.template.name).toBe('三国军师团')
})
