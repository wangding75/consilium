'use client'

import type { AgentType } from '@/types'

export interface RoleInfo {
  roleId: string
  name: string
  agentType: AgentType
  avatar: string
}

interface RoleBarProps {
  roles: RoleInfo[]
  activeSpeakerId: string | null
}

export function RoleBar({ roles: _roles, activeSpeakerId: _activeSpeakerId }: RoleBarProps) {
  return <div className="flex gap-2 overflow-x-auto py-2" />
}
