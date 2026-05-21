import type { DiscussionMessage } from '@/types'

export interface MessageRepository {
  findBySessionId(
    sessionId: string,
    opts?: { limit: number; before?: string }
  ): Promise<DiscussionMessage[]>
  save(msg: DiscussionMessage): Promise<DiscussionMessage>
  countBySessionId(sessionId: string): Promise<number>
  findByClientMessageId(clientMessageId: string, sessionId: string): Promise<DiscussionMessage | null>
  findRepliesByClientMessageId(sessionId: string, clientMessageId: string): Promise<DiscussionMessage[]>
  updateStatus(messageId: string, status: DiscussionMessage['status']): Promise<void>
}
