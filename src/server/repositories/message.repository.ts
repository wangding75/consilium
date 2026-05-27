import type { DiscussionMessage } from '@/types'

export interface MessageRepository {
  findById(messageId: string): Promise<DiscussionMessage | null>
  findBySessionId(
    sessionId: string,
    opts?: { limit: number; before?: string }
  ): Promise<DiscussionMessage[]>
  save(msg: DiscussionMessage): Promise<DiscussionMessage>
  countBySessionId(sessionId: string): Promise<number>
  findByClientMessageId(clientMessageId: string, sessionId: string): Promise<DiscussionMessage | null>
  findRepliesByClientMessageId(sessionId: string, clientMessageId: string): Promise<DiscussionMessage[]>
  updateStatus(messageId: string, status: DiscussionMessage['status']): Promise<void>
  updateMetadata(messageId: string, metadata: DiscussionMessage['metadata']): Promise<DiscussionMessage | null>
}
