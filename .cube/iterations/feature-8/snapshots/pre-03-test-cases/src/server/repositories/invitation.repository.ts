import type { Invitation, InvitationStatus, InvitationStatusPatch } from '@/types'

export interface InvitationRepository {
  findPendingBySessionId(sessionId: string): Promise<Invitation | null>
  findById(invitationId: string): Promise<Invitation | null>
  findRecentBySessionId(sessionId: string, limit?: number): Promise<Invitation[]>
  findByClientMessageId(sessionId: string, clientMessageId: string): Promise<Invitation | null>
  save(invitation: Invitation): Promise<Invitation>
  updateStatus(invitationId: string, status: InvitationStatus, patch?: InvitationStatusPatch): Promise<Invitation | null>
}
