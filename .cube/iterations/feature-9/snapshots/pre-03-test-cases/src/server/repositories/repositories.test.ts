import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'

it('MockTemplateRepository.findAll returns non-empty templates array', async () => {
  const repo = new MockTemplateRepository()
  const templates = await repo.findAll()
  expect(Array.isArray(templates)).toBe(true)
  expect(templates.length).toBeGreaterThan(0)
})

it('MockSessionRepository.findAll returns empty array', async () => {
  const repo = new MockSessionRepository()
  const sessions = await repo.findAll()
  expect(Array.isArray(sessions)).toBe(true)
  expect(sessions.length).toBe(0)
})

it('MockDiscussionRepository.findAll returns empty array', async () => {
  const repo = new MockDiscussionRepository()
  const discussions = await repo.findAll()
  expect(Array.isArray(discussions)).toBe(true)
  expect(discussions.length).toBe(0)
})
