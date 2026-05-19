import type { Discussion } from '@/types'
import type { DiscussionRepository } from '@/server/repositories/discussion.repository'
import type { SessionRepository } from '@/server/repositories/session.repository'
import type { TemplateRepository } from '@/server/repositories/template.repository'
import type { MessageRepository } from '@/server/repositories/message.repository'
import type { AgentCallLogRepository } from '@/server/repositories/agent-call-log.repository'
import type { DiscussionOrchestrator } from '@/engine/orchestrator'
import type { SessionDetailResult, MessageListResult, SendMessageResult } from '@/types/api'
import { ServiceError } from '@/server/errors'

export class DiscussionService {
  constructor(
    private readonly discussionRepo: DiscussionRepository,
    private readonly sessionRepo?: SessionRepository,
    private readonly templateRepo?: TemplateRepository,
    private readonly messageRepo?: MessageRepository,
    private readonly callLogRepo?: AgentCallLogRepository,
    private readonly orchestrator?: DiscussionOrchestrator
  ) {}

  async listDiscussions(): Promise<Discussion[]> {
    try {
      return await this.discussionRepo.findAll()
    } catch (err) {
      throw new ServiceError('DISCUSSION_LIST_FAILED', 'Failed to list discussions', err)
    }
  }

  async getSessionDetail(_sessionId: string): Promise<SessionDetailResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'getSessionDetail not implemented')
  }

  async getMessages(
    _sessionId: string,
    _opts: { limit: number; before?: string }
  ): Promise<MessageListResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'getMessages not implemented')
  }

  async sendUserMessage(
    _sessionId: string,
    _content: string,
    _clientMessageId?: string
  ): Promise<SendMessageResult> {
    throw new ServiceError('NOT_IMPLEMENTED', 'sendUserMessage not implemented')
  }
}
