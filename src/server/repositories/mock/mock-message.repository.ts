import type { DiscussionMessage } from '@/types'
import type { MessageRepository } from '../message.repository'

export class MockMessageRepository implements MessageRepository {
  private store = new Map<string, DiscussionMessage>()

  async findBySessionId(
    sessionId: string,
    opts?: { limit: number; before?: string }
  ): Promise<DiscussionMessage[]> {
    let results = Array.from(this.store.values()).filter((m) => m.sessionId === sessionId)
    if (opts?.limit) results = results.slice(-opts.limit)
    return results
  }

  async save(msg: DiscussionMessage): Promise<DiscussionMessage> {
    this.store.set(msg.messageId, msg)
    return msg
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return Array.from(this.store.values()).filter((m) => m.sessionId === sessionId).length
  }
}
