'use client'

import type { Invitation } from '@/types'

interface InviteCardProps {
  invitation: Invitation
  onRespond: (content: string) => void
  onSkip: () => void
  disabled?: boolean
  error?: string | null
}

export function InviteCard({ invitation, disabled = false, error }: InviteCardProps) {
  return (
    <section className="rounded-lg border border-border p-3 text-sm" aria-label="邀请你补充观点">
      <p className="font-medium">{invitation.prompt}</p>
      {error ? <p className="mt-2 text-destructive">{error}</p> : null}
      {disabled ? <p className="mt-2 text-muted-foreground">处理中...</p> : null}
    </section>
  )
}
