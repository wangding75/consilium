import { describe, it, expect } from 'vitest'
import type { ApiResponse, GetInvitationResult, RespondInvitationResult, SkipInvitationResult, RequestSummaryResult } from '@/types/api'

describe('Invitation and Summary API endpoint contracts', () => {
  it('GetInvitationResult shape has sessionId and invitation', () => {
    const result: GetInvitationResult = {
      sessionId: 'sess-1',
      invitation: null,
    }
    expect(result.sessionId).toBe('sess-1')
    expect(result.invitation).toBeNull()
  })

  it('RespondInvitationResult shape has invitation, userMessage, agentMessages', () => {
    const result: RespondInvitationResult = {
      sessionId: 'sess-1',
      invitation: {
        invitationId: 'inv-1',
        sessionId: 'sess-1',
        status: 'responded',
        prompt: '请参与',
        reason: 'disagreement',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      userMessage: null,
      agentMessages: [],
      activeSpeakerId: null,
    }
    expect(result.invitation.status).toBe('responded')
  })

  it('SkipInvitationResult shape has invitation and agentMessages', () => {
    const result: SkipInvitationResult = {
      sessionId: 'sess-1',
      invitation: {
        invitationId: 'inv-1',
        sessionId: 'sess-1',
        status: 'skipped',
        prompt: '请参与',
        reason: 'disagreement',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      agentMessages: [],
      activeSpeakerId: null,
    }
    expect(result.invitation.status).toBe('skipped')
  })

  it('RequestSummaryResult shape has summary, summaryMessage, sessionStatus', () => {
    const result: RequestSummaryResult = {
      sessionId: 'sess-1',
      summary: {
        summaryId: 'sum-1',
        sessionId: 'sess-1',
        messageId: 'msg-summary',
        consensus: ['c1'],
        disagreements: [],
        recommendations: [],
        nextSteps: [],
        checkpointCreatedAt: '2026-01-01T00:00:00.000Z',
      },
      summaryMessage: {
        messageId: 'msg-summary',
        sessionId: 'sess-1',
        type: 'host',
        content: '总结',
        status: 'completed',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      sessionStatus: 'completed',
      directorDecision: {
        decisionId: 'dec-1',
        sessionId: 'sess-1',
        action: 'conclude',
        reason: 'sufficient',
        confidence: 0.95,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    }
    expect(result.sessionStatus).toBe('completed')
    expect(result.summary.consensus).toHaveLength(1)
  })

  it('ApiResponse wraps GetInvitationResult', () => {
    const response: ApiResponse<GetInvitationResult> = {
      success: true,
      data: { sessionId: 'sess-1', invitation: null },
      requestId: 'req-1',
    }
    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.invitation).toBeNull()
    }
  })

  it('ApiResponse wraps error for invalid invitation', () => {
    const response: ApiResponse<RespondInvitationResult> = {
      success: false,
      data: null,
      error: { code: 'INVITATION_INVALID', message: 'Invitation not found' },
      requestId: 'req-2',
    }
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe('INVITATION_INVALID')
    }
  })
})
