'use client'

import type { Invitation } from '@/types'

interface InviteCardProps {
  invitation: Invitation
  onRespond: (content: string) => void
  onSkip: () => void
  disabled?: boolean
  error?: string | null
}

import { useState } from 'react'

export function InviteCard({ invitation, onRespond, onSkip, disabled = false, error }: InviteCardProps) {
  const [content, setContent] = useState('')

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (trimmed) {
      onRespond(trimmed)
      setContent('')
    }
  }

  return (
    <section className="rounded-lg border border-border p-3 text-sm" aria-label="邀请你补充观点">
      <p className="font-medium">{invitation.prompt}</p>
      {error ? <p className="mt-2 text-destructive">{error}</p> : null}
      {disabled ? (
        <p className="mt-2 text-muted-foreground">处理中...</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            className="w-full rounded border border-border bg-background p-2 text-sm resize-none"
            rows={2}
            placeholder="输入你的观点..."
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={disabled}
          />
          <div className="flex gap-2">
            <button
              className="rounded bg-primary px-3 py-1 text-primary-foreground text-sm disabled:opacity-50"
              onClick={handleSubmit}
              disabled={disabled || !content.trim()}
            >
              回应
            </button>
            <button
              className="rounded bg-secondary px-3 py-1 text-secondary-foreground text-sm disabled:opacity-50"
              onClick={onSkip}
              disabled={disabled}
            >
              跳过
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
