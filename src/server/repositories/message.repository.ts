import type { DiscussionMessage } from '@/types'

export interface MessageRepository {
  findBySessionId(
    sessionId: string,
    opts?: { limit: number; before?: string }
  ): Promise<DiscussionMessage[]>
  save(msg: DiscussionMessage): Promise<DiscussionMessage>
  countBySessionId(sessionId: string): Promise<number>
}
