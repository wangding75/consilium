import { describe, it, expect } from 'vitest'
import type { Invitation, DiscussionSummary, DirectorDecisionRecord } from '@/types'

describe('Discussion store invitation and summary state shape', () => {
  it('pendingInvitationBySessionId maps sessionId to Invitation', () => {
    const state: Record<string, Invitation | null> = {
      'sess-1': {
        invitationId: 'inv-1',
        sessionId: 'sess-1',
        status: 'pending',
        prompt: '请参与',
        reason: 'disagreement',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      'sess-2': null,
    }
    expect(state['sess-1']?.status).toBe('pending')
    expect(state['sess-2']).toBeNull()
  })

  it('summaryBySessionId maps sessionId to DiscussionSummary', () => {
    const state: Record<string, DiscussionSummary | null> = {
      'sess-1': {
        summaryId: 'sum-1',
        sessionId: 'sess-1',
        messageId: 'msg-summary',
        consensus: ['c1'],
        disagreements: [],
        recommendations: [],
        nextSteps: [],
        checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      },
    }
    expect(state['sess-1']?.consensus).toHaveLength(1)
  })

  it('directorErrorBySessionId maps sessionId to error string', () => {
    const state: Record<string, string | null> = {
      'sess-1': 'DIRECTOR_DECISION_FAILED',
      'sess-2': null,
    }
    expect(state['sess-1']).toBe('DIRECTOR_DECISION_FAILED')
    expect(state['sess-2']).toBeNull()
  })

  it('Invitation status transitions: pending → responded', () => {
    const invitation: Invitation = {
      invitationId: 'inv-1',
      sessionId: 'sess-1',
      status: 'responded',
      prompt: '请参与',
      reason: 'disagreement',
      respondedByMessageId: 'msg-resp',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(invitation.status).toBe('responded')
    expect(invitation.respondedByMessageId).toBe('msg-resp')
  })

  it('Invitation status transitions: pending → skipped', () => {
    const invitation: Invitation = {
      invitationId: 'inv-1',
      sessionId: 'sess-1',
      status: 'skipped',
      prompt: '请参与',
      reason: 'disagreement',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(invitation.status).toBe('skipped')
  })
})
