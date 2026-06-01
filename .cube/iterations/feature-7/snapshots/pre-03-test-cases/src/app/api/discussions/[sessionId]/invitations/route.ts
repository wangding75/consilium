import { NextResponse } from 'next/server'
import type { ApiResponse, GetInvitationResult } from '@/types/api'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<NextResponse<ApiResponse<GetInvitationResult>>> {
  const { sessionId } = await params
  return NextResponse.json({ success: true, data: { sessionId, invitation: null }, requestId: crypto.randomUUID() })
}

