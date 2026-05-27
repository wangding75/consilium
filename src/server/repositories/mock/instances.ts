import { MockSessionRepository } from './mock-session.repository'
import { MockTemplateRepository } from './mock-template.repository'
import { MockMessageRepository } from './mock-message.repository'
import { MockAgentCallLogRepository } from './mock-agent-call-log.repository'
import { MockInvitationRepository } from './mock-invitation.repository'
import { MockDirectorDecisionRepository } from './mock-director-decision.repository'

declare global {
  // eslint-disable-next-line no-var
  var __mockSessionRepo: MockSessionRepository | undefined
  // eslint-disable-next-line no-var
  var __mockTemplateRepo: MockTemplateRepository | undefined
  // eslint-disable-next-line no-var
  var __mockMessageRepo: MockMessageRepository | undefined
  // eslint-disable-next-line no-var
  var __mockAgentCallLogRepo: MockAgentCallLogRepository | undefined
  // eslint-disable-next-line no-var
  var __mockInvitationRepo: MockInvitationRepository | undefined
  // eslint-disable-next-line no-var
  var __mockDirectorDecisionRepo: MockDirectorDecisionRepository | undefined
}

globalThis.__mockSessionRepo ??= new MockSessionRepository()
globalThis.__mockTemplateRepo ??= new MockTemplateRepository()
globalThis.__mockMessageRepo ??= new MockMessageRepository()
globalThis.__mockAgentCallLogRepo ??= new MockAgentCallLogRepository()
globalThis.__mockInvitationRepo ??= new MockInvitationRepository()
globalThis.__mockDirectorDecisionRepo ??= new MockDirectorDecisionRepository()

export const sharedSessionRepo = globalThis.__mockSessionRepo
export const sharedTemplateRepo = globalThis.__mockTemplateRepo
export const sharedMessageRepo = globalThis.__mockMessageRepo
export const sharedAgentCallLogRepo = globalThis.__mockAgentCallLogRepo
export const sharedInvitationRepo = globalThis.__mockInvitationRepo
export const sharedDirectorDecisionRepo = globalThis.__mockDirectorDecisionRepo
