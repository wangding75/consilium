'use client'

import { RoleBar } from './role-bar'
import { MessageList } from './message-list'
import { MessageInput } from './message-input'

interface DiscussionModuleProps {
  sessionId: string
}

export function DiscussionModule({ sessionId }: DiscussionModuleProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold text-text-primary mb-1">讨论</h1>
        <p className="text-text-secondary text-sm">会话 ID：{sessionId}</p>
      </div>
      <RoleBar roles={[]} activeSpeakerId={null} />
      <MessageList messages={[]} isLoading={false} />
      <MessageInput onSend={async () => {}} disabled />
    </div>
  )
}
