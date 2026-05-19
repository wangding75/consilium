import { MockSessionRepository } from './mock-session.repository'
import { MockTemplateRepository } from './mock-template.repository'

declare global {
  // eslint-disable-next-line no-var
  var __mockSessionRepo: MockSessionRepository | undefined
  // eslint-disable-next-line no-var
  var __mockTemplateRepo: MockTemplateRepository | undefined
}

globalThis.__mockSessionRepo ??= new MockSessionRepository()
globalThis.__mockTemplateRepo ??= new MockTemplateRepository()

export const sharedSessionRepo = globalThis.__mockSessionRepo
export const sharedTemplateRepo = globalThis.__mockTemplateRepo
