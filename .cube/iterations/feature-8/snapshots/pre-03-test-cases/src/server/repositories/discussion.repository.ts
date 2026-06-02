import type { Discussion } from '@/types'

export interface DiscussionRepository {
  findAll(): Promise<Discussion[]>
  findById(id: string): Promise<Discussion | null>
}
