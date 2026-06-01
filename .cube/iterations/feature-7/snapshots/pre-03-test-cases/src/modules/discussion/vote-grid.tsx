'use client'

import type { EventRecord, VotePayload, VoteRecord } from '@/types'

interface VoteGridProps {
  event: EventRecord
  votes: VoteRecord[]
  pending?: boolean
  onVote?: (eventId: string, optionId: string) => void
}

function isVotePayload(payload: EventRecord['payload']): payload is VotePayload {
  return 'question' in payload && 'options' in payload && 'tally' in payload
}

export function VoteGrid({ event, votes, pending = false, onVote }: VoteGridProps) {
  if (!isVotePayload(event.payload)) return null

  const payload = event.payload
  const userVote = votes.find((vote) => vote.eventId === event.eventId && vote.voterType === 'user')

  return (
    <div className="mt-3 space-y-2">
      <p className="font-medium">{payload.question}</p>
      <div className="grid gap-2">
        {payload.options.map((option) => {
          const count = payload.tally[option.id] ?? 0
          const selected = userVote?.optionId === option.id
          const disabled = pending || event.status !== 'active' || Boolean(userVote)
          return (
            <button
              key={option.id}
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-left disabled:opacity-60"
              disabled={disabled}
              onClick={() => onVote?.(event.eventId, option.id)}
            >
              <span>{option.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{count} 票</span>
              {selected && <span className="ml-2 text-xs text-accent">已投</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
