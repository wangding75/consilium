import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'
import type { Session } from '@/types'
import type { CreateSessionParams, CreateSessionResult } from '@/types/api'
import { SessionService } from '@/server/services/session.service'
import { MockSessionRepository } from '@/server/repositories/mock/mock-session.repository'
import { MockTemplateRepository } from '@/server/repositories/mock/mock-template.repository'
import { ServiceError } from '@/server/errors'

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  const requestId = crypto.randomUUID()
  try {
    const service = new SessionService(new MockSessionRepository(), new MockTemplateRepository())
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
    const params = (await request.json()) as CreateSessionParams
    const service = new SessionService(new MockSessionRepository(), new MockTemplateRepository())
    const data = await service.createSession(params)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError) {
      const { code } = err
      const httpStatus = code === 'TEMPLATE_NOT_FOUND' ? 404 : 400
      if (code === 'TOPIC_REQUIRED' || code === 'TOPIC_TOO_LONG' || code === 'TEMPLATE_NOT_FOUND') {
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
