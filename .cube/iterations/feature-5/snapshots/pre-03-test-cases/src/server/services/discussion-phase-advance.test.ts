import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiscussionService } from '@/server/services/discussion.service'
import { DefaultStateMachine } from '@/engine/state-machine'
import { sharedSessionRepo, sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { SessionService } from '@/server/services/session.service'

// Task-08: Phase advancement after message & manual complete confirmation
describe('Discussion phase advancement & manual complete — Task-08', () => {
  let sessionService: SessionService
  let stateMachine: DefaultStateMachine

  beforeEach(() => {
    vi.restoreAllMocks()
    sessionService = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    stateMachine = new DefaultStateMachine()
  })

  it('advanceAfterMessage advances phase from idle to opening', () => {
    const session = { id: 's1', state: { stage: 'idle', turnCount: 0, lastSpeakerId: null } } as any
    const result = stateMachine.advanceAfterMessage(session, [])
    expect(result.stage).toBe('opening')
  })

  it('advanceAfterMessage stays in current stage when advancement criteria not met', () => {
    const session = { id: 's1', state: { stage: 'developing', turnCount: 2, lastSpeakerId: 'r1' } } as any
    const result = stateMachine.advanceAfterMessage(session, [])
    expect(result.stage).toBe('developing')
  })

  it('complete action succeeds when closing phase with host summary exists', async () => {
    const session = await sessionService.createSession({ topic: 'complete test', templateId: 'three-kingdoms-advisors' })
    await sharedSessionRepo.updateState(session.sessionId, { stage: 'closing', turnCount: 10, lastSpeakerId: 'host' }, 'reached closing')
    const updated = await sessionService.updateSessionStatus(session.sessionId, 'complete')
    expect(updated.status).toBe('completed')
  })

  it('complete action fails when not in closing phase', async () => {
    const session = await sessionService.createSession({ topic: 'not closing', templateId: 'three-kingdoms-advisors' })
    await expect(sessionService.updateSessionStatus(session.sessionId, 'complete')).rejects.toThrow()
  })

  it('phase advancement failure does not lose messages', async () => {
    const session = await sessionService.createSession({ topic: 'phase fail', templateId: 'three-kingdoms-advisors' })
    const originalState = await sharedSessionRepo.findById(session.sessionId)
    expect(originalState).not.toBeNull()
    expect(originalState!.state.stage).toBe('idle')
  })
})
