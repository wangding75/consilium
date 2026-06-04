import { describe, it, expect } from 'vitest'
import {
  sharedEventRepo,
  sharedVoteRepo,
  sharedSessionRepo,
  sharedMessageRepo,
} from '@/server/repositories/mock/instances'
import { MockEventRepository } from '@/server/repositories/mock/mock-event.repository'
import { MockVoteRepository } from '@/server/repositories/mock/mock-vote.repository'

describe('Shared mock instances — event and vote repositories exported', () => {
  it('exports sharedEventRepo as MockEventRepository instance', () => {
    expect(sharedEventRepo).toBeInstanceOf(MockEventRepository)
  })

  it('exports sharedVoteRepo as MockVoteRepository instance', () => {
    expect(sharedVoteRepo).toBeInstanceOf(MockVoteRepository)
  })

  it('sharedEventRepo is singleton — same reference across imports', async () => {
    const { sharedEventRepo: repo2 } = await import('@/server/repositories/mock/instances')
    expect(sharedEventRepo).toBe(repo2)
  })

  it('sharedVoteRepo is singleton — same reference across imports', async () => {
    const { sharedVoteRepo: repo2 } = await import('@/server/repositories/mock/instances')
    expect(sharedVoteRepo).toBe(repo2)
  })

  it('existing repos (session, message) are not replaced', () => {
    expect(sharedSessionRepo).toBeDefined()
    expect(sharedMessageRepo).toBeDefined()
  })
})
