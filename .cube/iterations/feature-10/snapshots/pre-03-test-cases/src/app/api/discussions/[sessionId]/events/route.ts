import { NextResponse } from 'next/server'
import type { ApiResponse, CreateEventRequest, CreateEventResult, EventListResult } from '@/types/api'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import {
  sharedEventRepo,
  sharedMessageRepo,
  sharedSessionRepo,
  sharedTemplateRepo,
  sharedVoteRepo,
} from '@/server/repositories/mock/instances'
import { DefaultEventDetector, DefaultEventRateLimiter } from '@/engine/events'
import { ServiceError } from '@/server/errors'

function createService(): DiscussionService {
  return new DiscussionService(
    new MockDiscussionRepository(),
    sharedSessionRepo,
    sharedTemplateRepo,
    sharedMessageRepo,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    sharedEventRepo,
    sharedVoteRepo,
    new DefaultEventDetector(),
    new DefaultEventRateLimiter()
  )
}

function toErrorResponse(error: unknown, requestId: string): NextResponse<ApiResponse<never>> {
  if (error instanceof ServiceError) {
    return NextResponse.json(
      { success: false, data: null, error: { code: error.code, message: error.message }, requestId },
      { status: error.code === 'SESSION_NOT_FOUND' ? 404 : 400 }
    )
  }
  return NextResponse.json(
    { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
    { status: 500 }
  )
}

function hasString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isVotePayload(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const payload = value as { question?: unknown; options?: unknown; tally?: unknown }
  return (
    hasString(payload.question) &&
    Array.isArray(payload.options) &&
    payload.options.length > 0 &&
    payload.options.every((option) => {
      if (!option || typeof option !== 'object') return false
      const candidate = option as { id?: unknown; label?: unknown; roles?: unknown }
      return hasString(candidate.id) && hasString(candidate.label) && isStringArray(candidate.roles)
    }) &&
    !!payload.tally &&
    typeof payload.tally === 'object' &&
    Object.values(payload.tally).every((count) => typeof count === 'number')
  )
}

function isEventPayload(eventType: string, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  if (eventType === 'slap') {
    return hasString(payload.refuter) && hasString(payload.refuted) && hasString(payload.refutedView) && hasString(payload.reason)
  }
  if (eventType === 'camp') {
    return Array.isArray(payload.camps) && payload.camps.every((camp) => {
      if (!camp || typeof camp !== 'object') return false
      const candidate = camp as { name?: unknown; roleIds?: unknown; stance?: unknown }
      return hasString(candidate.name) && isStringArray(candidate.roleIds) && hasString(candidate.stance)
    })
  }
  if (eventType === 'vote') return isVotePayload(value)
  if (eventType === 'reverse') {
    return hasString(payload.premise) && hasString(payload.newVariable) && hasString(payload.impact)
  }
  return false
}

function isCreateEventRequest(value: unknown): value is CreateEventRequest {
  if (!value || typeof value !== 'object') return false
  const body = value as Partial<CreateEventRequest>
  const eventTypes = ['slap', 'camp', 'vote', 'reverse']
  return (
    typeof body.eventType === 'string' &&
    eventTypes.includes(body.eventType) &&
    typeof body.title === 'string' &&
    body.title.trim().length > 0 &&
    typeof body.description === 'string' &&
    body.description.trim().length > 0 &&
    isEventPayload(body.eventType, body.payload)
  )
}

function validationError(requestId: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid event request' }, requestId },
    { status: 400 }
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<EventListResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const service = createService()
    const data = await service.listEvents(sessionId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (error) {
    return toErrorResponse(error, requestId)
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<CreateEventResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const body = await req.json()
    if (!isCreateEventRequest(body)) return validationError(requestId)
    const service = createService()
    const data = await service.createEvent(sessionId, body, 'manual')
    return NextResponse.json({ success: true, data, requestId })
  } catch (error) {
    return toErrorResponse(error, requestId)
  }
}
