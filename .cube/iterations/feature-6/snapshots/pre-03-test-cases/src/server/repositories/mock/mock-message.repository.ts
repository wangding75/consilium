import type { DiscussionMessage } from '@/types'
import type { MessageRepository } from '../message.repository'

export class MockMessageRepository implements MessageRepository {
  private store = new Map<string, DiscussionMessage>()
  private clientIdIndex = new Map<string, string>()

  async findById(messageId: string): Promise<DiscussionMessage | null> {
    return this.store.get(messageId) ?? null
  }

  async findBySessionId(
    sessionId: string,
    opts?: { limit: number; before?: string }
  ): Promise<DiscussionMessage[]> {
    let results = Array.from(this.store.values())
      .filter((m) => m.sessionId === sessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    if (opts?.before) {
      const beforeIndex = results.findIndex((m) => m.messageId === opts.before)
      results = beforeIndex >= 0 ? results.slice(0, beforeIndex) : []
    }

    if (opts?.limit) results = results.slice(-opts.limit)
    return results
  }

  async save(msg: DiscussionMessage): Promise<DiscussionMessage> {
    const existing = this.store.get(msg.messageId)
    if (existing?.clientMessageId && existing.clientMessageId !== msg.clientMessageId) {
      this.clientIdIndex.delete(`${existing.sessionId}:${existing.clientMessageId}`)
    }
    this.store.set(msg.messageId, msg)
    if (msg.clientMessageId) {
      this.clientIdIndex.set(`${msg.sessionId}:${msg.clientMessageId}`, msg.messageId)
    }
    return msg
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return Array.from(this.store.values()).filter((m) => m.sessionId === sessionId).length
  }

  async findByClientMessageId(
    clientMessageId: string,
    sessionId: string
  ): Promise<DiscussionMessage | null> {
    const messageId = this.clientIdIndex.get(`${sessionId}:${clientMessageId}`)
    return messageId ? (this.store.get(messageId) ?? null) : null
  }

  async findRepliesByClientMessageId(
    sessionId: string,
    clientMessageId: string
  ): Promise<DiscussionMessage[]> {
    return Array.from(this.store.values())
      .filter(
        (m) =>
          m.sessionId === sessionId &&
          m.type !== 'user' &&
          m.metadata?.replyToClientMessageId === clientMessageId
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async updateStatus(messageId: string, status: DiscussionMessage['status']): Promise<void> {
    const message = this.store.get(messageId)
    if (!message) return
    this.store.set(messageId, { ...message, status })
  }

  async updateMetadata(messageId: string, metadata: DiscussionMessage['metadata']): Promise<DiscussionMessage | null> {
    const message = this.store.get(messageId)
    if (!message) return null
    const updated = { ...message, metadata: { ...message.metadata, ...metadata } }
    this.store.set(messageId, updated)
    return updated
  }
}
