import { describe, it, expect, beforeEach } from 'vitest'
import { MockInvitationRepository } from './mock-invitation.repository'
import type { Invitation } from '@/types'

function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    invitationId: 'inv-1',
    sessionId: 'sess-1',
    status: 'pending',
    prompt: '请参与讨论',
    reason: 'disagreement detected',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('MockInvitationRepository', () => {
  let repo: MockInvitationRepository

  beforeEach(() => {
    repo = new MockInvitationRepository()
  })

  describe('save', () => {
    it('saves an invitation and returns it', async () => {
      const invitation = makeInvitation()
      const result = await repo.save(invitation)
      expect(result).toEqual(invitation)
    })

    it('overwrites existing invitation with same id', async () => {
      await repo.save(makeInvitation({ prompt: '第一版' }))
      const updated = await repo.save(makeInvitation({ prompt: '第二版' }))
      expect(updated.prompt).toBe('第二版')
    })
  })

  describe('findPendingBySessionId', () => {
    it('returns null when no pending invitation exists', async () => {
      const result = await repo.findPendingBySessionId('sess-1')
      expect(result).toBeNull()
    })

    it('returns pending invitation for the session', async () => {
      await repo.save(makeInvitation({ sessionId: 'sess-1', status: 'pending' }))
      const result = await repo.findPendingBySessionId('sess-1')
      expect(result).not.toBeNull()
      expect(result!.status).toBe('pending')
      expect(result!.sessionId).toBe('sess-1')
    })

    it('returns null when invitation is responded', async () => {
      await repo.save(makeInvitation({ sessionId: 'sess-1', status: 'responded' }))
      const result = await repo.findPendingBySessionId('sess-1')
      expect(result).toBeNull()
    })

    it('returns null when invitation is skipped', async () => {
      await repo.save(makeInvitation({ sessionId: 'sess-1', status: 'skipped' }))
      const result = await repo.findPendingBySessionId('sess-1')
      expect(result).toBeNull()
    })

    it('does not return invitation from another session', async () => {
      await repo.save(makeInvitation({ sessionId: 'sess-1', status: 'pending' }))
      const result = await repo.findPendingBySessionId('sess-2')
      expect(result).toBeNull()
    })
  })

  describe('findById', () => {
    it('returns null for non-existent id', async () => {
      const result = await repo.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns invitation by id', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1' }))
      const result = await repo.findById('inv-1')
      expect(result).not.toBeNull()
      expect(result!.invitationId).toBe('inv-1')
    })
  })

  describe('findRecentBySessionId', () => {
    it('returns empty array when no invitations exist', async () => {
      const result = await repo.findRecentBySessionId('sess-1')
      expect(result).toEqual([])
    })

    it('returns invitations sorted by createdAt descending', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1', createdAt: '2026-01-01T00:00:00.000Z' }))
      await repo.save(makeInvitation({ invitationId: 'inv-2', createdAt: '2026-01-02T00:00:00.000Z' }))
      const result = await repo.findRecentBySessionId('sess-1')
      expect(result[0].invitationId).toBe('inv-2')
      expect(result[1].invitationId).toBe('inv-1')
    })

    it('respects limit parameter', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1', createdAt: '2026-01-01T00:00:00.000Z' }))
      await repo.save(makeInvitation({ invitationId: 'inv-2', createdAt: '2026-01-02T00:00:00.000Z' }))
      await repo.save(makeInvitation({ invitationId: 'inv-3', createdAt: '2026-01-03T00:00:00.000Z' }))
      const result = await repo.findRecentBySessionId('sess-1', 2)
      expect(result).toHaveLength(2)
    })

    it('only returns invitations for the specified session', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1', sessionId: 'sess-1' }))
      await repo.save(makeInvitation({ invitationId: 'inv-2', sessionId: 'sess-2' }))
      const result = await repo.findRecentBySessionId('sess-1')
      expect(result).toHaveLength(1)
      expect(result[0].invitationId).toBe('inv-1')
    })
  })

  describe('findByClientMessageId', () => {
    it('returns null when no match', async () => {
      const result = await repo.findByClientMessageId('sess-1', 'client-1')
      expect(result).toBeNull()
    })

    it('returns invitation matching sessionId and clientMessageId', async () => {
      await repo.save(makeInvitation({ clientMessageId: 'client-1', sessionId: 'sess-1' }))
      const result = await repo.findByClientMessageId('sess-1', 'client-1')
      expect(result).not.toBeNull()
      expect(result!.clientMessageId).toBe('client-1')
    })

    it('does not return invitation from another session', async () => {
      await repo.save(makeInvitation({ clientMessageId: 'client-1', sessionId: 'sess-1' }))
      const result = await repo.findByClientMessageId('sess-2', 'client-1')
      expect(result).toBeNull()
    })
  })

  describe('updateStatus', () => {
    it('returns null for non-existent invitation', async () => {
      const result = await repo.updateStatus('nonexistent', 'responded')
      expect(result).toBeNull()
    })

    it('updates status and updatedAt', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1', status: 'pending', updatedAt: '2026-01-01T00:00:00.000Z' }))
      const result = await repo.updateStatus('inv-1', 'responded', { respondedByMessageId: 'msg-resp' })
      expect(result).not.toBeNull()
      expect(result!.status).toBe('responded')
      expect(result!.respondedByMessageId).toBe('msg-resp')
      expect(result!.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
    })

    it('preserves other fields when updating status', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1', prompt: '请参与', reason: 'disagreement' }))
      await repo.updateStatus('inv-1', 'skipped')
      const found = await repo.findById('inv-1')
      expect(found!.prompt).toBe('请参与')
      expect(found!.reason).toBe('disagreement')
    })

    it('idempotent: skipping already skipped invitation returns current state', async () => {
      await repo.save(makeInvitation({ invitationId: 'inv-1', status: 'pending' }))
      const first = await repo.updateStatus('inv-1', 'skipped')
      const second = await repo.updateStatus('inv-1', 'skipped')
      expect(second!.status).toBe('skipped')
    })
  })
})
