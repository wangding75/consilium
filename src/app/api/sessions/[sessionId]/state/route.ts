import { NextResponse } from 'next/server'
import type { ApiResponse, SessionStateResult } from '@/types/api'
import { SessionService } from '@/server/services/session.service'
import { sharedSessionRepo, sharedTemplateRepo } from '@/server/repositories/mock/instances'
import { ServiceError } from '@/server/errors'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<SessionStateResult>>> {
  const requestId = crypto.randomUUID()
  try {
    const { sessionId } = await params
    const service = new SessionService(sharedSessionRepo, sharedTemplateRepo)
    const data = await service.getSessionState(sessionId)
    return NextResponse.json({ success: true, data, requestId })
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'SESSION_NOT_FOUND') {
      return NextResponse.json(
        { success: false, data: null, error: { code: err.code, message: err.message }, requestId },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { success: false, data: null, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }, requestId },
      { status: 500 }
    )
  }
}
