import { NextResponse } from 'next/server'
import type { ApiResponse, CreateSessionParams, CreateSessionResult } from '@/types/api'
import type { Session } from '@/types'
import { SessionService } from '@/server/services/session.service'
import { sharedSessionRepo, sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    const data = await service.listSessions()
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    const code = 'INTERNAL_ERROR'
    const message = err instanceof ServiceError ? err.message : 'An unexpected error occurred'
    return NextResponse.json(
      { success: false, data: null, error: { code, message }, requestId },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<CreateSessionResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const body = (await request.json()) as Record<string, unknown>
    if (typeof body.topic !== 'string' || typeof body.templateId !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: { code: 'INVALID_REQUEST', message: 'topic and templateId must be strings' }, requestId },
        { status: 400 }
      )
    }
    const params: CreateSessionParams = {
      topic: body.topic,
      templateId: body.templateId,
      modelStrategyId: typeof body.modelStrategyId === 'string' ? body.modelStrategyId : undefined,
    }
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    const data = await service.createSession(params)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const { code } = err
      const httpStatus = code === 'TEMPLATE_NOT_FOUND' ? 404 : 400
      if (code === 'TOPIC_REQUIRED' || code === 'TOPIC_TOO_LONG' || code === 'TEMPLATE_NOT_FOUND' || code === 'INVALID_STRATEGY') {
        return NextResponse.json(
          { success: false, data: null, error: { code, message: err.message }, requestId },
          { status: httpStatus }
        )
      }
    }
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        requestId,
      },
      { status: 500 }
    )
  }
}
