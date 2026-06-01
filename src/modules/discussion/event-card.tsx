'use client'

import type { CampPayload, EventRecord, ReversePayload, SlapPayload, VoteRecord } from '@/types'
import { VoteGrid } from './vote-grid'

interface EventCardProps {
  event: EventRecord
  votes: VoteRecord[]
  pending?: boolean
  onVote?: (eventId: string, optionId: string) => void
}

function isSlapPayload(payload: EventRecord['payload']): payload is SlapPayload {
  return 'refuter' in payload && 'refuted' in payload && 'refutedView' in payload && 'reason' in payload
}

function isCampPayload(payload: EventRecord['payload']): payload is CampPayload {
  return 'camps' in payload
}

function isReversePayload(payload: EventRecord['payload']): payload is ReversePayload {
  return 'premise' in payload && 'newVariable' in payload && 'impact' in payload
}

function EventDetail({ event }: { event: EventRecord }) {
  if (event.eventType === 'slap' && isSlapPayload(event.payload)) {
    return <p className="mt-2 text-xs text-muted-foreground">{event.payload.refuter} 反驳 {event.payload.refuted}</p>
  }

  if (event.eventType === 'camp' && isCampPayload(event.payload)) {
    return <p className="mt-2 text-xs text-muted-foreground">形成 {event.payload.camps.length} 个阵营</p>
  }

  if (event.eventType === 'reverse' && isReversePayload(event.payload)) {
    return <p className="mt-2 text-xs text-muted-foreground">变量反转：{event.payload.newVariable}</p>
  }

  return null
}

export function EventCard({ event, votes, pending = false, onVote }: EventCardProps) {
  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{event.title}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {event.eventType}
        </span>
      </div>
      <p className="text-muted-foreground">{event.description}</p>
      <EventDetail event={event} />
      {event.eventType === 'vote' && (
        <VoteGrid event={event} votes={votes} pending={pending} onVote={onVote} />
      )}
    </div>
  )
}
