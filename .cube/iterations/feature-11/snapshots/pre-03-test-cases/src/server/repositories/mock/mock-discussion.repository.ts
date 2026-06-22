import type { Discussion } from '@/types'
import type { DiscussionRepository } from '../discussion.repository'

export class MockDiscussionRepository implements DiscussionRepository {
  async findAll(): Promise<Discussion[]> {
    return []
  }

  async findById(_id: string): Promise<Discussion | null> {
    return null
  }
}
