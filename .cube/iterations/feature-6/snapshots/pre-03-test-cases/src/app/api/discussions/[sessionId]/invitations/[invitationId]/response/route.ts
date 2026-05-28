import { NextResponse } from 'next/server'
import type { ApiResponse, RespondInvitationResult } from '@/types/api'

export async function POST(
  _req: Request,
  _ctx: { params: Promise<{ sessionId: string; invitationId: string }> }
): Promise<NextResponse<ApiResponse<RespondInvitationResult>>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'NOT_IMPLEMENTED', message: 'This endpoint skeleton is not implemented yet' },
      requestId: crypto.randomUUID(),
    },
    { status: 501 }
  )
}

