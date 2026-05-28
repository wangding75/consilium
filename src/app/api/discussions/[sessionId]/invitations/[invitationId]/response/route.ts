import { NextResponse } from 'next/server'
import type { ApiResponse, RespondInvitationResult, RespondInvitationRequest } from '@/types/api'
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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string; invitationId: string }> }
): Promise<NextResponse<ApiResponse<RespondInvitationResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId, invitationId } = await params
    const body = (await req.json()) as Partial<RespondInvitationRequest>
    const content = body.content ?? ''
    if (!content.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'MESSAGE_EMPTY', message: 'Invitation response content cannot be empty' }, requestId },
        { status: 400 }
      )
    }
    const service = createService()
    const data = await service.respondInvitation(sessionId, invitationId, {
      content,
      clientMessageId: body.clientMessageId,
    })
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const httpStatus =
        err.code === 'SESSION_NOT_FOUND'
          ? 404
          : err.code === 'INVITATION_INVALID'
            ? 400
            : err.code === 'MESSAGE_EMPTY'
              ? 400
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
