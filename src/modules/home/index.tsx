'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@/types'
import type { CreateSessionParams } from '@/types/api'
import { MODEL_STRATEGIES, DEFAULT_STRATEGY_ID } from '@/data/model-strategies'

const QUICK_START_TOPICS = [
  '评估新功能优先级',
  '制定市场进入策略',
  '分析用户增长方案',
  '优化定价策略',
]

const DEFAULT_TEMPLATE_ID = 'three-kingdoms-advisors'
const DEFAULT_TEMPLATE_NAME = '三国军师团'
const TEMPLATE_NAMES: Record<string, string> = {
  [DEFAULT_TEMPLATE_ID]: DEFAULT_TEMPLATE_NAME,
}

export function HomeModule() {
  const router = useRouter()

  const [topic, setTopic] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [selectedStrategyId, setSelectedStrategyId] = useState(DEFAULT_STRATEGY_ID)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false)
  const [isStrategySheetOpen, setIsStrategySheetOpen] = useState(false)

  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)
  const [recentError, setRecentError] = useState('')

  useEffect(() => {
    void loadRecentSessions()
  }, [])

  async function loadRecentSessions() {
    setIsLoadingRecent(true)
    setRecentError('')
    try {
      const res = await fetch('/api/sessions/recent')
      const json = await res.json()
      if (json.success) {
        setRecentSessions(json.data)
      } else {
        setRecentError(json.error?.message ?? '加载失败')
      }
    } catch {
      setRecentError('网络错误，请稍后重试')
    } finally {
      setIsLoadingRecent(false)
    }
  }

  async function handleSubmit() {
    if (!topic.trim()) {
      setTopicError('请输入讨论议题')
      return
    }
    setTopicError('')
    setIsSubmitting(true)
    try {
      const params: CreateSessionParams = {
        topic: topic.trim(),
        templateId: selectedTemplateId,
        modelStrategyId: selectedStrategyId,
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (json.success) {
        router.push(`/discussion/${json.data.sessionId}`)
      } else {
        setTopicError(json.error?.message ?? '创建失败，请重试')
      }
    } catch {
      setTopicError('网络错误，请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedStrategy = MODEL_STRATEGIES.find(s => s.id === selectedStrategyId)

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* Hero 区 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <textarea
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm resize-none text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="输入讨论议题..."
            maxLength={100}
            rows={3}
            value={topic}
            onChange={e => {
              setTopic(e.target.value)
              if (topicError) setTopicError('')
            }}
          />
          <div className="flex justify-between items-center px-1">
            {topicError ? (
              <span className="text-xs text-red-500">{topicError}</span>
            ) : (
              <span />
            )}
            <span className={`text-xs ${topic.length >= 100 ? 'text-red-500' : 'text-text-muted'}`}>
              {topic.length}/100
            </span>
          </div>
        </div>

        <button
          type="button"
          className="w-full rounded-xl border border-border bg-surface p-3 text-left flex justify-between items-center"
          onClick={() => setIsTemplateSheetOpen(true)}
        >
          <span className="text-xs text-text-muted">模板</span>
          <span className="text-sm text-text-primary">{TEMPLATE_NAMES[selectedTemplateId] ?? selectedTemplateId}</span>
        </button>

        <button
          type="button"
          className="w-full rounded-xl border border-border bg-surface p-3 text-left flex justify-between items-center"
          onClick={() => setIsStrategySheetOpen(true)}
        >
          <span className="text-xs text-text-muted">模型策略</span>
          <span className="text-sm text-text-primary">{selectedStrategy?.name ?? ''}</span>
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => void handleSubmit()}
          className="w-full rounded-xl bg-accent text-white py-3 text-sm font-medium disabled:opacity-60"
        >
          {isSubmitting ? '创建中...' : '开始讨论'}
        </button>
      </section>

      {/* 快速开始 */}
      <section>
        <p className="text-xs text-text-muted mb-2">快速开始</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_START_TOPICS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary bg-surface"
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* 最近讨论 */}
      <section>
        <p className="text-xs text-text-muted mb-2">最近讨论</p>
        {isLoadingRecent ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-border/30 animate-pulse" />
            ))}
          </div>
        ) : recentError ? (
          <p className="text-xs text-red-500">{recentError}</p>
        ) : recentSessions.length === 0 ? (
          <p className="text-xs text-text-muted">暂无最近讨论</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentSessions.map(session => (
              <button
                key={session.id}
                type="button"
                onClick={() => router.push(`/discussion/${session.id}`)}
                className="w-full rounded-xl border border-border bg-surface p-3 text-left"
              >
                <p className="text-sm text-text-primary truncate">{session.topic}</p>
                <p className="text-xs text-text-muted mt-1">
                  {session.status === 'active' ? '进行中' : '已完成'} ·{' '}
                  {new Date(session.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 模板 Sheet */}
      {isTemplateSheetOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end"
          onClick={() => setIsTemplateSheetOpen(false)}
        >
          <div
            className="w-full bg-surface rounded-t-2xl p-4 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-text-primary">选择模板</p>
            <button
              type="button"
              className={`rounded-xl border p-3 text-left ${selectedTemplateId === DEFAULT_TEMPLATE_ID ? 'border-accent' : 'border-border'}`}
              onClick={() => {
                setSelectedTemplateId(DEFAULT_TEMPLATE_ID)
                setIsTemplateSheetOpen(false)
              }}
            >
              <p className="text-sm text-text-primary">{DEFAULT_TEMPLATE_NAME}</p>
            </button>
            {['创业公司董事会', '产品辩论桌'].map(name => (
              <div
                key={name}
                className="rounded-xl border border-border p-3 opacity-40 flex justify-between items-center"
              >
                <p className="text-sm text-text-primary">{name}</p>
                <span className="text-xs text-text-muted">即将支持</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 策略 Sheet */}
      {isStrategySheetOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end"
          onClick={() => setIsStrategySheetOpen(false)}
        >
          <div
            className="w-full bg-surface rounded-t-2xl p-4 flex flex-col gap-3"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-text-primary">选择模型策略</p>
            {MODEL_STRATEGIES.map(s => (
              <button
                key={s.id}
                type="button"
                className={`rounded-xl border p-3 text-left ${selectedStrategyId === s.id ? 'border-accent' : 'border-border'}`}
                onClick={() => {
                  setSelectedStrategyId(s.id)
                  setIsStrategySheetOpen(false)
                }}
              >
                <p className="text-sm text-text-primary">{s.name}</p>
                <p className="text-xs text-text-muted mt-1">{s.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
