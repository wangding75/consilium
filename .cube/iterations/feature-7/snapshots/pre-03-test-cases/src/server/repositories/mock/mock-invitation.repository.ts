import type { Invitation, InvitationStatus, InvitationStatusPatch } from '@/types'
import type { InvitationRepository } from '../invitation.repository'

export class MockInvitationRepository implements InvitationRepository {
  private readonly store = new Map<string, Invitation>()

  async findPendingBySessionId(sessionId: string): Promise<Invitation | null> {
    return Array.from(this.store.values()).find((item) => item.sessionId === sessionId && item.status === 'pending') ?? null
  }

  async findById(invitationId: string): Promise<Invitation | null> {
    return this.store.get(invitationId) ?? null
  }

  async findRecentBySessionId(sessionId: string, limit = 10): Promise<Invitation[]> {
    return Array.from(this.store.values())
      .filter((item) => item.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
  }

  async findByClientMessageId(sessionId: string, clientMessageId: string): Promise<Invitation | null> {
    return Array.from(this.store.values()).find((item) => item.sessionId === sessionId && item.clientMessageId === clientMessageId) ?? null
  }

  async save(invitation: Invitation): Promise<Invitation> {
    this.store.set(invitation.invitationId, invitation)
    return invitation
  }

  async updateStatus(invitationId: string, status: InvitationStatus, patch?: InvitationStatusPatch): Promise<Invitation | null> {
    const invitation = this.store.get(invitationId)
    if (!invitation) return null
    const updated = { ...invitation, ...patch, status, updatedAt: new Date().toISOString() }
    this.store.set(invitationId, updated)
    return updated
  }
}
