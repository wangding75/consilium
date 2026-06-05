import { NextResponse } from 'next/server'
import type { ApiResponse, VoteRequest, VoteResult } from '@/types/api'
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
    const status = error.code === 'SESSION_NOT_FOUND' || error.code === 'EVENT_NOT_FOUND' ? 404 : 400
    return NextResponse.json(
      { success: false, data: null, error: { code: error.code, message: error.message }, requestId },
      { status }
    )
  }
  return NextResponse.json(
    { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
    { status: 500 }
  )
}

function isVoteRequest(value: unknown): value is VoteRequest {
  if (!value || typeof value !== 'object') return false
  const body = value as Partial<VoteRequest>
  return typeof body.optionId === 'string' && body.optionId.trim().length > 0
}

function validationError(requestId: string): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid vote request' }, requestId },
    { status: 400 }
  )
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string; eventId: string }> }
): Promise<NextResponse<ApiResponse<VoteResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId, eventId } = await params
    const body = await req.json()
    if (!isVoteRequest(body)) return validationError(requestId)
    const service = createService()
    const data = await service.submitVote(sessionId, eventId, body)
    return NextResponse.json({ success: true, data, requestId })
  } catch (error) {
    return toErrorResponse(error, requestId)
  }
}
