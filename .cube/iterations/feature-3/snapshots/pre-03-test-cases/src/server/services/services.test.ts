import { TemplateService } from '@/server/services/template.service'
import { SessionService } from '@/server/services/session.service'
import { DiscussionService } from '@/server/services/discussion.service'
import { LlmService } from '@/server/services/llm.service'
import { getAppConfig } from '@/config'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'

it('TemplateService.listTemplates returns array of templates', async () => {
  const service = new TemplateService(new MockTemplateRepository())
  const templates = await service.listTemplates()
  expect(Array.isArray(templates)).toBe(true)
  expect(templates.length).toBeGreaterThan(0)
})

it('SessionService.listSessions returns array', async () => {
  const service = new SessionService(new MockSessionRepository(), new MockTemplateRepository())
  const sessions = await service.listSessions()
  expect(Array.isArray(sessions)).toBe(true)
})

it('DiscussionService.listDiscussions returns array', async () => {
  const service = new DiscussionService(new MockDiscussionRepository())
  const discussions = await service.listDiscussions()
  expect(Array.isArray(discussions)).toBe(true)
})

it('LlmService.listProviders returns non-empty providers array', async () => {
  const service = new LlmService(getAppConfig())
  const providers = await service.listProviders()
  expect(Array.isArray(providers)).toBe(true)
  expect(providers.length).toBeGreaterThan(0)
})
