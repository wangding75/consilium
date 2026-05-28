'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@/types'

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
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('running')
  const [keyword, setKeyword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    void loadSessions()
  }, [activeTab, keyword])

  async function loadSessions() {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', activeTab)
      if (keyword) params.set('keyword', keyword)
      const res = await fetch(`/api/sessions?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setSessions(json.data)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
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
              key={session.id}
              className="w-full rounded-xl border border-border bg-surface p-3 text-left"
            >
              <div className="flex justify-between items-start">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => router.push(`/discussion/${session.id}`)}
                >
                  <p className="text-sm text-text-primary truncate">{session.topic}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {STATUS_LABELS[session.status] ?? session.status} · {new Date(session.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </button>
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent ml-2 shrink-0">
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                {(session.status === 'running' || session.status === 'active') && (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => void handleAction(session.id, 'archive')}
                  >
                    归档
                  </button>
                )}
                {session.status === 'archived' && (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => void handleAction(session.id, 'resume')}
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
