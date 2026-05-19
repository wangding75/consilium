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

export function RoleBar({ roles, activeSpeakerId }: RoleBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto py-2 px-4 border-b border-border">
      {roles.map((role) => {
        const active = role.roleId === activeSpeakerId
        return (
          <div key={role.roleId} className="flex flex-col items-center gap-1 min-w-14">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm ${active ? 'ring-2 ring-primary' : ''}`}
            >
              {role.avatar || role.name.slice(0, 1)}
            </div>
            <span className="max-w-16 truncate text-xs text-text-secondary">{role.name}</span>
          </div>
        )
      })}
    </div>
  )
}
