'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionListItem } from '@/types/api'

type FilterTab = 'running' | 'completed' | 'archived'

const TAB_LABELS: Record<FilterTab, string> = {
  running: '进行中',
  completed: '已完成',
  archived: '已归档',
}

const STATUS_LABELS: Record<string, string> = {
  running: '进行中',
  active: '进行中',
  completed: '已完成',
  archived: '已归档',
}

export function SessionsModule() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionListItem[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('running')
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const requestIdRef = useRef(0)

  useEffect(() => {
    void loadSessions()
  }, [activeTab, keyword])

  async function loadSessions() {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsLoading(true)
    setLoadError('')

    try {
      const params = new URLSearchParams()
      params.set('status', activeTab)
      if (keyword) params.set('keyword', keyword)
      const res = await fetch(`/api/sessions?${params.toString()}`)
      const json = await res.json()

      if (requestId !== requestIdRef.current) {
        return
      }

      if (json.success) {
        setSessions(json.data.sessions)
        return
      }

      setSessions([])
      setLoadError(json.error?.message ?? '加载失败')
    } catch {
      if (requestId !== requestIdRef.current) {
        return
      }

      setSessions([])
      setLoadError('网络错误，请稍后重试')
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }

  async function handleAction(sessionId: string, action: 'archive' | 'resume') {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (json.success) {
        await loadSessions()
      }
    } catch {
      // silent
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-text-primary">会话</h1>

      <input
        type="text"
        className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
        placeholder="搜索会话..."
        value={keyword}
        onChange={e => setKeyword(e.target.value)}
      />

      <div className="flex gap-2">
        {(Object.keys(TAB_LABELS) as FilterTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${activeTab === tab ? 'bg-accent text-white' : 'bg-surface border border-border text-text-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-red-500">{loadError}</p>
          <button
            type="button"
            className="w-fit rounded-xl border border-border px-3 py-1.5 text-xs text-text-primary"
            onClick={() => void loadSessions()}
          >
            重试
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-text-muted">暂无会话</p>
          <div className="flex gap-2 text-xs text-text-muted">
            <span>归档</span>
            <span>恢复</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map(session => (
            <div
              key={session.sessionId}
              className="w-full rounded-xl border border-border bg-surface p-3 text-left"
            >
              <div className="flex justify-between items-start gap-2">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => router.push(`/discussion/${session.sessionId}`)}
                >
                  <p className="text-sm text-text-primary truncate">{session.topic}</p>
                  <p className="mt-1 text-xs text-text-muted">{session.template.name}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    {session.roleCount} 角色 · {session.eventCount} 事件 · {session.messageCount} 消息
                  </p>
                  {session.modelStrategy && (
                    <p className="mt-1 text-xs text-text-muted">{session.modelStrategy.name}</p>
                  )}
                  {!session.template.fromSnapshot && session.template.fallbackReason && (
                    <p className="mt-1 text-xs text-text-muted">使用兜底模板信息恢复</p>
                  )}
                </button>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent shrink-0">
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                {(session.status === 'running' || session.status === 'active') && (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => void handleAction(session.sessionId, 'archive')}
                  >
                    归档
                  </button>
                )}
                {session.status === 'archived' && (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => void handleAction(session.sessionId, 'resume')}
                  >
                    恢复
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
