'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Session } from '@/types'
import type { CreateSessionParams, TemplateSummary } from '@/types/api'
import type { ModelStrategy } from '@/data/model-strategies'

const QUICK_START_TOPICS = [
  '评估新功能优先级',
  '制定市场进入策略',
  '分析用户增长方案',
  '优化定价策略',
]

export function HomeModule() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [topic, setTopic] = useState('')
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [strategies, setStrategies] = useState<ModelStrategy[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedStrategyId, setSelectedStrategyId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [isTemplateSheetOpen, setIsTemplateSheetOpen] = useState(false)
  const [isStrategySheetOpen, setIsStrategySheetOpen] = useState(false)

  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(false)
  const [recentError, setRecentError] = useState('')

  useEffect(() => {
    void loadInitialData()
    void loadRecentSessions()
  }, [])

  async function loadInitialData() {
    try {
      const [templatesRes, strategiesRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/model-strategies'),
      ])
      const templatesJson = await templatesRes.json()
      const strategiesJson = await strategiesRes.json()

      if (templatesJson.success) {
        const nextTemplates = templatesJson.data.templates as TemplateSummary[]
        setTemplates(nextTemplates)
        const queryTemplateId = searchParams.get('templateId')
        const preselectedTemplate = nextTemplates.find((template) => template.templateId === queryTemplateId)
        setSelectedTemplateId(preselectedTemplate?.templateId ?? nextTemplates[0]?.templateId ?? '')
      }

      if (strategiesJson.success) {
        const nextStrategies = strategiesJson.data.strategies as ModelStrategy[]
        setStrategies(nextStrategies)
        setSelectedStrategyId(strategiesJson.data.defaultModelStrategyId ?? nextStrategies[0]?.id ?? '')
      }
    } catch {
      setTopicError('网络错误，请稍后重试')
    }
  }

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

  const selectedTemplate = templates.find((template) => template.templateId === selectedTemplateId)
  const selectedStrategy = strategies.find((strategy) => strategy.modelStrategyId === selectedStrategyId)

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
          <span className="text-sm text-text-primary">{selectedTemplate?.name ?? selectedTemplateId}</span>
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
                  {session.status === 'running' || session.status === 'active' ? '进行中' : session.status === 'archived' ? '已归档' : '已完成'} ·{' '}
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
            {templates.map(template => (
              <button
                key={template.templateId}
                type="button"
                className={`rounded-xl border p-3 text-left ${selectedTemplateId === template.templateId ? 'border-accent' : 'border-border'}`}
                onClick={() => {
                  setSelectedTemplateId(template.templateId)
                  setIsTemplateSheetOpen(false)
                }}
              >
                <p className="text-sm text-text-primary">{template.name}</p>
                <p className="text-xs text-text-muted mt-1">{template.description}</p>
              </button>
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
            {strategies.map(strategy => (
              <button
                key={strategy.modelStrategyId}
                type="button"
                className={`rounded-xl border p-3 text-left ${selectedStrategyId === strategy.modelStrategyId ? 'border-accent' : 'border-border'}`}
                onClick={() => {
                  setSelectedStrategyId(strategy.modelStrategyId)
                  setIsStrategySheetOpen(false)
                }}
              >
                <p className="text-sm text-text-primary">{strategy.name}</p>
                <p className="text-xs text-text-muted mt-1">{strategy.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
