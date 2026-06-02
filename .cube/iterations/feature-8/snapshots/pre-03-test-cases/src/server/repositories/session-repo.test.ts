import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import type { Session } from '@/types'

function makeSession(override: Partial<Session> = {}): Session {
  return {
    id: '',
    templateId: 'three-kingdoms-advisors',
    topic: '测试议题',
    status: 'active',
    state: { stage: 'idle', turnCount: 0, lastSpeakerId: null },
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...override,
  }
}

it('MockSessionRepository.findRecent returns empty array when store is empty', async () => {
  const repo = new MockSessionRepository()
  const result = await repo.findRecent()
  expect(Array.isArray(result)).toBe(true)
  expect(result.filter(s => s.topic.startsWith('__empty_check__'))).toHaveLength(0)
})

it('MockSessionRepository.save assigns a uuid id when id is empty', async () => {
  const repo = new MockSessionRepository()
  const session = makeSession({ id: '' })
  const saved = await repo.save(session)
  expect(typeof saved.id).toBe('string')
  expect(saved.id.length).toBeGreaterThan(0)
})

it('MockSessionRepository.save persists session and findById retrieves it', async () => {
  const repo = new MockSessionRepository()
  const session = makeSession({ id: '', topic: '可检索议题' })
  const saved = await repo.save(session)
  const found = await repo.findById(saved.id)
  expect(found).not.toBeNull()
  expect(found!.topic).toBe('可检索议题')
})

it('MockSessionRepository.findRecent returns saved sessions sorted by createdAt desc', async () => {
  const repo = new MockSessionRepository()
  const futureBase = Date.now() + 999999
  const old = makeSession({ id: '', topic: '旧议题_sort_test', createdAt: futureBase })
  const recent = makeSession({ id: '', topic: '新议题_sort_test', createdAt: futureBase + 1 })
  await repo.save(old)
  await repo.save(recent)
  const result = await repo.findRecent()
  const my = result.filter(s => s.topic.endsWith('_sort_test'))
  expect(my[0].topic).toBe('新议题_sort_test')
  expect(my[1].topic).toBe('旧议题_sort_test')
})

it('MockSessionRepository.findRecent respects limit parameter', async () => {
  const repo = new MockSessionRepository()
  for (let i = 0; i < 5; i++) {
    await repo.save(makeSession({ id: '', topic: `议题${i}`, createdAt: i * 1000 }))
  }
  const result = await repo.findRecent(3)
  expect(result).toHaveLength(3)
})

it('MockSessionRepository.findById returns null for nonexistent id', async () => {
  const repo = new MockSessionRepository()
  const result = await repo.findById('nonexistent-id')
  expect(result).toBeNull()
})

it('MockSessionRepository.delete removes the session', async () => {
  const repo = new MockSessionRepository()
  const saved = await repo.save(makeSession({ id: '' }))
  await repo.delete(saved.id)
  const found = await repo.findById(saved.id)
  expect(found).toBeNull()
})
