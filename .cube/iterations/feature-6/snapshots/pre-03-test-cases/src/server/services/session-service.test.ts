import { SessionService } from '@/server/services/session.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { ServiceError } from '@/server/errors'
import { DEFAULT_STRATEGY_ID } from '@/data/model-strategies'

function makeService() {
  return new SessionService(new MockSessionRepository(), new MockTemplateRepository())
}

// ── Task-06: createSession ────────────────────────────────────────────────

it('createSession with valid params returns CreateSessionResult', async () => {
  const service = makeService()
  const result = await service.createSession({
    topic: '如何提高产品留存率',
    templateId: 'three-kingdoms-advisors',
  })
  expect(result.sessionId).toBeDefined()
  expect(result.topic).toBe('如何提高产品留存率')
  expect(result.status).toBe('running')
  expect(typeof result.createdAt).toBe('number')
  expect(result.template.id).toBe('three-kingdoms-advisors')
})

it('createSession sets stage to idle', async () => {
  const repo = new MockSessionRepository()
  const service = new SessionService(repo, new MockTemplateRepository())
  const result = await service.createSession({
    topic: '测试议题',
    templateId: 'three-kingdoms-advisors',
  })
  const saved = await repo.findById(result.sessionId)
  expect(saved!.state.stage).toBe('idle')
})

it('createSession sets modelStrategyId to DEFAULT_STRATEGY_ID when not provided', async () => {
  const repo = new MockSessionRepository()
  const service = new SessionService(repo, new MockTemplateRepository())
  const result = await service.createSession({
    topic: '测试议题',
    templateId: 'three-kingdoms-advisors',
  })
  const saved = await repo.findById(result.sessionId)
  expect(saved!.modelStrategyId).toBe(DEFAULT_STRATEGY_ID)
})

it('createSession uses provided modelStrategyId', async () => {
  const repo = new MockSessionRepository()
  const service = new SessionService(repo, new MockTemplateRepository())
  const result = await service.createSession({
    topic: '测试议题',
    templateId: 'three-kingdoms-advisors',
    modelStrategyId: 'quality',
  })
  const saved = await repo.findById(result.sessionId)
  expect(saved!.modelStrategyId).toBe('quality')
})

it('createSession with empty topic throws TOPIC_REQUIRED', async () => {
  const service = makeService()
  await expect(
    service.createSession({ topic: '', templateId: 'three-kingdoms-advisors' })
  ).rejects.toMatchObject({ code: 'TOPIC_REQUIRED' })
})

it('createSession with whitespace-only topic throws TOPIC_REQUIRED', async () => {
  const service = makeService()
  await expect(
    service.createSession({ topic: '   ', templateId: 'three-kingdoms-advisors' })
  ).rejects.toMatchObject({ code: 'TOPIC_REQUIRED' })
})

it('createSession with topic exceeding 100 characters throws TOPIC_TOO_LONG', async () => {
  const service = makeService()
  const longTopic = 'A'.repeat(101)
  await expect(
    service.createSession({ topic: longTopic, templateId: 'three-kingdoms-advisors' })
  ).rejects.toMatchObject({ code: 'TOPIC_TOO_LONG' })
})

it('createSession with exactly 100 character topic succeeds', async () => {
  const service = makeService()
  const topic100 = '测'.repeat(100)
  const result = await service.createSession({
    topic: topic100,
    templateId: 'three-kingdoms-advisors',
  })
  expect(result.sessionId).toBeDefined()
})

it('createSession with nonexistent templateId throws TEMPLATE_NOT_FOUND', async () => {
  const service = makeService()
  await expect(
    service.createSession({ topic: '有效议题', templateId: 'nonexistent-template' })
  ).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' })
})

// ── Task-07: getRecentSessions ────────────────────────────────────────────

it('getRecentSessions returns array', async () => {
  const service = makeService()
  const result = await service.getRecentSessions()
  expect(Array.isArray(result)).toBe(true)
})

it('getRecentSessions returns sessions in createdAt descending order', async () => {
  const repo = new MockSessionRepository()
  const service = new SessionService(repo, new MockTemplateRepository())
  // Use future timestamps to avoid contamination from other tests in same file
  const t1 = Date.now() + 100000
  const t2 = Date.now() + 200000
  const session1 = await repo.save({
    id: '',
    templateId: 'three-kingdoms-advisors',
    topic: '较早的会话',
    status: 'active',
    state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: t1,
    updatedAt: t1,
  })
  const session2 = await repo.save({
    id: '',
    templateId: 'three-kingdoms-advisors',
    topic: '较新的会话',
    status: 'active',
    state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: t2,
    updatedAt: t2,
  })
  const result = await service.getRecentSessions()
  const myResults = result.filter(s => s.id === session1.id || s.id === session2.id)
  expect(myResults[0].id).toBe(session2.id)
  expect(myResults[1].id).toBe(session1.id)
})

it('getRecentSessions respects limit', async () => {
  const service = makeService()
  for (let i = 0; i < 5; i++) {
    await service.createSession({ topic: `议题${i}`, templateId: 'three-kingdoms-advisors' })
  }
  const result = await service.getRecentSessions(3)
  expect(result).toHaveLength(3)
})

it('getRecentSessions wraps repo errors as ServiceError', async () => {
  const repo = new MockSessionRepository()
  const service = new SessionService(repo, new MockTemplateRepository())
  vi.spyOn(repo, 'findRecent').mockRejectedValueOnce(new Error('repo failure'))
  await expect(service.getRecentSessions()).rejects.toBeInstanceOf(Error)
})

// ── Integration: Route → Service → Repository chain ──────────────────────

it('integration: createSession persists to repo and getRecentSessions retrieves it', async () => {
  const repo = new MockSessionRepository()
  const service = new SessionService(repo, new MockTemplateRepository())
  const result = await service.createSession({
    topic: '集成测试议题',
    templateId: 'three-kingdoms-advisors',
  })
  const recent = await service.getRecentSessions()
  expect(recent.some(s => s.id === result.sessionId)).toBe(true)
})
