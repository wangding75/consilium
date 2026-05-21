import { NextResponse } from 'next/server'
import type { ApiResponse, MessageListResult, SendMessageParams, SendMessageResult } from '@/types/api'
import { DiscussionService } from '@/server/services/discussion.service'
import { MockDiscussionRepository } from '@/server/repositories/mock/mock-discussion.repository'
import {
  sharedSessionRepo,
  sharedTemplateRepo,
  sharedMessageRepo,
  sharedAgentCallLogRepo,
} from '@/server/repositories/mock/instances'
import { DiscussionOrchestrator } from '@/engine/orchestrator'
import { RoundRobinScheduler } from '@/engine/scheduler'
import { ContextBuilder } from '@/engine/context-builder'
import { DefaultAgentRuntime } from '@/engine/agent-runtime'
import { MockLLMClient } from '@/llm/mock-llm-client'
import { ServiceError } from '@/server/errors'

function createService(): DiscussionService {
  const orchestrator = new DiscussionOrchestrator(
    new RoundRobinScheduler(),
    new ContextBuilder(),
    new DefaultAgentRuntime(new MockLLMClient())
  )
  return new DiscussionService(
    new MockDiscussionRepository(),
    sharedSessionRepo,
    sharedTemplateRepo,
    sharedMessageRepo,
    sharedAgentCallLogRepo,
    orchestrator
  )
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<MessageListResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const url = new URL(req.url)
    const rawLimit = url.searchParams.get('limit') ?? '50'
    const limit = parseInt(rawLimit, 10)
    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'limit must be a positive integer' }, requestId },
        { status: 400 }
      )
    }
    if (limit > 100) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'limit must not exceed 100' }, requestId },
        { status: 400 }
      )
    }
    const before = url.searchParams.get('before') ?? undefined
    const service = createService()
    const data = await service.getMessages(sessionId, { limit, before })
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const errorCode = err instanceof ServiceError ? err.code : (err as { code?: string })?.code
    if (errorCode === 'SESSION_NOT_FOUND') {
      const message = err instanceof Error ? err.message : 'Session not found'
      return NextResponse.json(
        { success: false, data: null, error: { code: 'SESSION_NOT_FOUND', message }, requestId },
        { status: 404 }
      )
    }
    if (err instanceof ServiceError) {
      const httpStatus =
        err.code === 'TEMPLATE_NOT_FOUND'
          ? 404
          : err.code === 'MESSAGE_EMPTY'
            ? 400
            : err.code === 'LLM_PROVIDER_ERROR'
              ? 502
              : 500
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status: httpStatus }
      )
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<SendMessageResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const body = (await req.json()) as Partial<SendMessageParams>
    const content = body.content ?? ''
    const service = createService()
    const data = await service.sendUserMessage(sessionId, content, body.clientMessageId, body.intentResponse as SendMessageParams['intentResponse'])
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const errorCode = err instanceof ServiceError ? err.code : (err as { code?: string })?.code
    if (errorCode === 'SESSION_NOT_FOUND') {
      const message = err instanceof Error ? err.message : 'Session not found'
      return NextResponse.json(
        { success: false, data: null, error: { code: 'SESSION_NOT_FOUND', message }, requestId },
        { status: 404 }
      )
    }
    if (err instanceof ServiceError) {
      const httpStatus =
        err.code === 'TEMPLATE_NOT_FOUND'
          ? 404
          : err.code === 'MESSAGE_EMPTY' || err.code === 'SESSION_CONTEXT_MISMATCH'
            ? 400
          : err.code === 'SESSION_NOT_OPERABLE'
            ? 409
            : err.code === 'LLM_PROVIDER_ERROR'
              ? 502
              : 500
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status: httpStatus }
      )
    }
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message }, requestId },
      { status: 500 }
    )
  }
}
