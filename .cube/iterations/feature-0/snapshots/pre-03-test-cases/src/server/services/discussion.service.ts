import type { Discussion } from '@/types'
import type { DiscussionRepository } from '@/server/repositories/discussion.repository'
import { ServiceError } from '@/server/errors'

export class DiscussionService {
  constructor(private readonly repo: DiscussionRepository) {}

  async listDiscussions(): Promise<Discussion[]> {
    try {
      return await this.repo.findAll()
    } catch (err) {
      throw new ServiceError('DISCUSSION_LIST_FAILED', 'Failed to list discussions', err)
    }
  }
}
