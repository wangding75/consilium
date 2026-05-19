import type { DiscussionMessage } from '@/types'
import type { MessageRepository } from '../message.repository'

export class MockMessageRepository implements MessageRepository {
  async findBySessionId(
    _sessionId: string,
    _opts?: { limit: number; before?: string }
  ): Promise<DiscussionMessage[]> {
    throw new Error('not implemented')
  }

  async save(_msg: DiscussionMessage): Promise<DiscussionMessage> {
    throw new Error('not implemented')
  }

  async countBySessionId(_sessionId: string): Promise<number> {
    throw new Error('not implemented')
  }
}
