'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscussionTemplate, TemplateRole } from '@/types'
import type { TemplateSummary } from '@/types/api'

type ActiveTab = 'detail' | 'roles'

export function TemplatesModule() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateDetail, setTemplateDetail] = useState<DiscussionTemplate | null>(null)
  const [roles, setRoles] = useState<TemplateRole[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('detail')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadTemplates()
  }, [])

  useEffect(() => {
    if (!selectedTemplateId) {
      return
    }

    if (activeTab === 'detail') {
      void loadTemplateDetail(selectedTemplateId)
      return
    }

    void loadTemplateRoles(selectedTemplateId)
  }, [selectedTemplateId, activeTab])

  async function loadTemplates() {
    setError('')
    try {
      const res = await fetch('/api/templates')
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message ?? '模板加载失败')
        return
      }

      const nextTemplates = json.data.templates as TemplateSummary[]
      setTemplates(nextTemplates)
      setSelectedTemplateId(nextTemplates[0]?.templateId ?? '')
    } catch {
      setError('模板加载失败')
    }
  }

  async function loadTemplateDetail(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}`)
      const json = await res.json()
      if (json.success) {
        setTemplateDetail(json.data.template)
      }
    } catch {
      setTemplateDetail(null)
    }
  }

  async function loadTemplateRoles(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}/roles`)
      const json = await res.json()
      if (json.success) {
        setRoles(json.data.roles)
      }
    } catch {
      setRoles([])
    }
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <button
          type="button"
          onClick={() => void loadTemplates()}
          className="rounded-xl border border-border px-4 py-2 text-sm"
        >
          重试
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">模板</h1>
          <p className="text-text-secondary text-sm">查看和管理讨论模板</p>
        </div>
        <button
          type="button"
          className="rounded-xl bg-accent px-4 py-2 text-sm text-white"
          onClick={() => router.push(`/?templateId=${selectedTemplateId}`)}
          disabled={!selectedTemplateId}
        >
          使用模板
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        {templates.map((template) => (
          <button
            key={template.templateId}
            type="button"
            className={`w-full rounded-lg px-3 py-2 text-left ${selectedTemplateId === template.templateId ? 'bg-background' : ''}`}
            onClick={() => setSelectedTemplateId(template.templateId)}
          >
            <p className="text-sm text-text-primary">{template.name}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'detail'}
          className={`rounded-xl border px-4 py-2 text-sm ${activeTab === 'detail' ? 'border-accent text-accent' : 'border-border'}`}
          onClick={() => setActiveTab('detail')}
        >
          详情
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'roles'}
          className={`rounded-xl border px-4 py-2 text-sm ${activeTab === 'roles' ? 'border-accent text-accent' : 'border-border'}`}
          onClick={() => setActiveTab('roles')}
        >
          角色
        </button>
      </div>

      {activeTab === 'detail' ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-text-primary">{templateDetail?.name}</h2>
          <p className="mt-2 text-sm text-text-secondary">{templateDetail?.description}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
          {roles.map((role) => (
            <div key={role.roleId} className="rounded-lg bg-background px-3 py-2">
              <p className="text-sm text-text-primary">{role.name}</p>
              <p className="mt-1 text-xs text-text-muted">{role.persona}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
