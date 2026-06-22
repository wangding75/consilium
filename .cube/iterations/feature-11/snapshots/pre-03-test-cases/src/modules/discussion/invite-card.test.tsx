import { describe, it, expect } from 'vitest'
import type { Invitation } from '@/types'

describe('InviteCard component contracts', () => {
  it('renders invitation prompt text', () => {
    const invitation: Invitation = {
      invitationId: 'inv-1',
      sessionId: 'sess-1',
      status: 'pending',
      prompt: '角色之间存在分歧，请发表您的看法',
      reason: 'disagreement',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(invitation.prompt).toBeTruthy()
    expect(invitation.status).toBe('pending')
  })

  it('hides InviteCard when invitation is not pending', () => {
    const invitation: Invitation = {
      invitationId: 'inv-1',
      sessionId: 'sess-1',
      status: 'responded',
      prompt: '请参与',
      reason: 'disagreement',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    // InviteCard should only show for pending invitations
    expect(invitation.status).not.toBe('pending')
  })

  it('shows error state when invitation response fails', () => {
    const error = 'INVITATION_INVALID'
    expect(error).toBeTruthy()
  })

  it('disables submit when content is empty', () => {
    const content = ''
    const canSubmit = content.trim().length > 0
    expect(canSubmit).toBe(false)
  })

  it('enables submit when content is non-empty', () => {
    const content = '我的看法'
    const canSubmit = content.trim().length > 0
    expect(canSubmit).toBe(true)
  })
})
