import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/discussions/[sessionId]/events/route'
import { POST as VOTE_POST } from '@/app/api/discussions/[sessionId]/events/[eventId]/vote/route'
import { DiscussionService } from '@/server/services/discussion.service'
import { ServiceError } from '@/server/errors'
import type { ApiResponse, EventListResult, CreateEventResult, VoteResult } from '@/types/api'
import type { EventRecord, VoteRecord, VotePayload } from '@/types'

const makeParams = (sessionId: string) => Promise.resolve({ sessionId })
const makeVoteParams = (sessionId: string, eventId: string) =>
  Promise.resolve({ sessionId, eventId })

const makeVotePayload = (): VotePayload => ({
  question: '迁都何处',
  options: [
    { id: 'opt1', label: '许昌', roles: ['zgl'] },
    { id: 'opt2', label: '洛阳', roles: ['simayi'] },
  ],
  tally: { opt1: 0, opt2: 0 },
})

const makeEventRecord = (): EventRecord => ({
  eventId: 'evt-001',
  sessionId: 's1',
  eventType: 'vote',
  trigger: 'manual',
  status: 'active',
  title: '迁都投票',
  description: '请投票',
  reason: '用户触发',
  payload: makeVotePayload(),
  relatedMessageId: 'msg-001',
  createdAt: '2026-06-01T00:00:00Z',
})

const makeVoteRecord = (): VoteRecord => ({
  voteId: 'vote-001',
  sessionId: 's1',
  eventId: 'evt-001',
  voterType: 'user',
  voterId: 'current-user',
  optionId: 'opt1',
  createdAt: '2026-06-01T00:00:00Z',
})

// web-e2e: route handler called directly (Next.js in-process, real HTTP entry point via route handler)

describe('Task-09: GET /api/discussions/[sessionId]/events', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns 200 with events and votes on success', async () => {
    vi.spyOn(DiscussionService.prototype, 'listEvents').mockResolvedValue({
      sessionId: 's1',
      events: [makeEventRecord()],
      votes: [makeVoteRecord()],
    })
    const req = new Request('http://localhost/api/discussions/s1/events')
    const res = await GET(req, { params: makeParams('s1') })
    const json = await res.json() as ApiResponse<EventListResult>
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    if (!json.success) throw new Error('expected success response')
    expect(json.data.events).toHaveLength(1)
    expect(json.data.votes).toHaveLength(1)
    expect(json.requestId).toBeDefined()
  })

  it('returns 404 when session is not found', async () => {
    vi.spyOn(DiscussionService.prototype, 'listEvents').mockRejectedValue(
      new ServiceError('SESSION_NOT_FOUND', 'Session not found')
    )
    const req = new Request('http://localhost/api/discussions/unknown/events')
    const res = await GET(req, { params: makeParams('unknown') })
    const json = await res.json() as ApiResponse<never>
    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('returns 200 with empty events and votes arrays when no events', async () => {
    vi.spyOn(DiscussionService.prototype, 'listEvents').mockResolvedValue({
      sessionId: 's1',
      events: [],
      votes: [],
    })
    const req = new Request('http://localhost/api/discussions/s1/events')
    const res = await GET(req, { params: makeParams('s1') })
    const json = await res.json() as ApiResponse<EventListResult>
    expect(res.status).toBe(200)
    if (!json.success) throw new Error('expected success response')
    expect(json.data.events).toHaveLength(0)
  })
})

describe('Task-09: POST /api/discussions/[sessionId]/events', () => {
  beforeEach(() => vi.restoreAllMocks())

  const makeCreateBody = () => ({
    eventType: 'vote',
    title: '迁都投票',
    description: '请投票',
    payload: makeVotePayload(),
  })

  it('returns 200 with created event and message on success', async () => {
    const mockMessage = {
      messageId: 'msg-event-001',
      sessionId: 's1',
      type: 'host' as const,
      content: '请投票',
      status: 'completed' as const,
      createdAt: '2026-06-01T00:00:00Z',
      metadata: { hostMessageKind: 'event' as const, eventId: 'evt-001' },
    }
    vi.spyOn(DiscussionService.prototype, 'createEvent').mockResolvedValue({
      event: makeEventRecord(),
      message: mockMessage,
    })
    const req = new Request('http://localhost/api/discussions/s1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeCreateBody()),
    })
    const res = await POST(req, { params: makeParams('s1') })
    const json = await res.json() as ApiResponse<CreateEventResult>
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    if (!json.success) throw new Error('expected success response')
    expect(json.data.event.eventId).toBe('evt-001')
    expect(json.data.message.metadata?.hostMessageKind).toBe('event')
  })

  it('returns 400 for VALIDATION_ERROR when request body is invalid', async () => {
    const req = new Request('http://localhost/api/discussions/s1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'unknown', title: '', description: '' }),
    })
    const res = await POST(req, { params: makeParams('s1') })
    const json = await res.json() as ApiResponse<never>
    expect(res.status).toBe(400)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for SESSION_NOT_FOUND', async () => {
    vi.spyOn(DiscussionService.prototype, 'createEvent').mockRejectedValue(
      new ServiceError('SESSION_NOT_FOUND', 'Session not found')
    )
    const req = new Request('http://localhost/api/discussions/unknown/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeCreateBody()),
    })
    const res = await POST(req, { params: makeParams('unknown') })
    expect(res.status).toBe(404)
  })

  it('response includes requestId field', async () => {
    const mockMessage = {
      messageId: 'msg-event-001',
      sessionId: 's1',
      type: 'host' as const,
      content: '请投票',
      status: 'completed' as const,
      createdAt: '2026-06-01T00:00:00Z',
    }
    vi.spyOn(DiscussionService.prototype, 'createEvent').mockResolvedValue({
      event: makeEventRecord(),
      message: mockMessage,
    })
    const req = new Request('http://localhost/api/discussions/s1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeCreateBody()),
    })
    const res = await POST(req, { params: makeParams('s1') })
    const json = await res.json() as ApiResponse<CreateEventResult>
    expect(json.requestId).toBeDefined()
    expect(typeof json.requestId).toBe('string')
  })
})

describe('Task-09: POST /api/discussions/[sessionId]/events/[eventId]/vote', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns 200 with vote and updated event on success', async () => {
    vi.spyOn(DiscussionService.prototype, 'submitVote').mockResolvedValue({
      vote: makeVoteRecord(),
      event: makeEventRecord(),
    })
    const req = new Request('http://localhost/api/discussions/s1/events/evt-001/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: 'opt1' }),
    })
    const res = await VOTE_POST(req, { params: makeVoteParams('s1', 'evt-001') })
    const json = await res.json() as ApiResponse<VoteResult>
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    if (!json.success) throw new Error('expected success response')
    expect(json.data.vote.optionId).toBe('opt1')
    expect(json.data.event.eventId).toBe('evt-001')
  })

  it('returns 400 for VALIDATION_ERROR when optionId is missing', async () => {
    const req = new Request('http://localhost/api/discussions/s1/events/evt-001/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await VOTE_POST(req, { params: makeVoteParams('s1', 'evt-001') })
    const json = await res.json() as ApiResponse<never>
    expect(res.status).toBe(400)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for EVENT_NOT_FOUND', async () => {
    vi.spyOn(DiscussionService.prototype, 'submitVote').mockRejectedValue(
      new ServiceError('EVENT_NOT_FOUND', 'Event not found')
    )
    const req = new Request('http://localhost/api/discussions/s1/events/unknown/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: 'opt1' }),
    })
    const res = await VOTE_POST(req, { params: makeVoteParams('s1', 'unknown') })
    expect(res.status).toBe(404)
    const json = await res.json() as ApiResponse<never>
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('EVENT_NOT_FOUND')
  })

  it('returns 400 for EVENT_NOT_VOTABLE', async () => {
    vi.spyOn(DiscussionService.prototype, 'submitVote').mockRejectedValue(
      new ServiceError('EVENT_NOT_VOTABLE', 'Event is not votable')
    )
    const req = new Request('http://localhost/api/discussions/s1/events/evt-001/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: 'opt1' }),
    })
    const res = await VOTE_POST(req, { params: makeVoteParams('s1', 'evt-001') })
    const json = await res.json() as ApiResponse<never>
    expect(res.status).toBe(400)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('EVENT_NOT_VOTABLE')
  })

  it('returns 400 for VOTE_OPTION_INVALID', async () => {
    vi.spyOn(DiscussionService.prototype, 'submitVote').mockRejectedValue(
      new ServiceError('VOTE_OPTION_INVALID', 'Option not found')
    )
    const req = new Request('http://localhost/api/discussions/s1/events/evt-001/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: 'bad-opt' }),
    })
    const res = await VOTE_POST(req, { params: makeVoteParams('s1', 'evt-001') })
    const json = await res.json() as ApiResponse<never>
    expect(res.status).toBe(400)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('VOTE_OPTION_INVALID')
  })

  it('returns 400 for EVENT_CLOSED', async () => {
    vi.spyOn(DiscussionService.prototype, 'submitVote').mockRejectedValue(
      new ServiceError('EVENT_CLOSED', 'Vote is closed')
    )
    const req = new Request('http://localhost/api/discussions/s1/events/evt-001/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: 'opt1' }),
    })
    const res = await VOTE_POST(req, { params: makeVoteParams('s1', 'evt-001') })
    const json = await res.json() as ApiResponse<never>
    expect(res.status).toBe(400)
    if (json.success) throw new Error('expected error response')
    expect(json.error.code).toBe('EVENT_CLOSED')
  })
})
