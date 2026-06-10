'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscussionTemplate, TemplateRole } from '@/types'
import type { CreateTemplateRoleRequest, TemplateListSettingsResult } from '@/types/api'
import { ConfirmDialog } from '@/modules/settings/ConfirmDialog'

type ActiveTab = 'detail' | 'roles'

type TemplateSettingsSummary = TemplateListSettingsResult['templates'][number]

const EMPTY_ROLE_FORM: CreateTemplateRoleRequest = {
  name: '',
  persona: '',
  systemPrompt: '',
  providerConnectionId: '',
  model: '',
  enabled: true,
}

export function TemplatesModule() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateSettingsSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateDetail, setTemplateDetail] = useState<DiscussionTemplate | null>(null)
  const [roles, setRoles] = useState<TemplateRole[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('detail')
  const [error, setError] = useState('')
  const [roleForm, setRoleForm] = useState<CreateTemplateRoleRequest>(EMPTY_ROLE_FORM)
  const [savingRole, setSavingRole] = useState(false)
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)

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

      const nextTemplates = json.data.templates as TemplateListSettingsResult['templates']
      setTemplates(nextTemplates)
      setSelectedTemplateId((current) => current || nextTemplates[0]?.templateId || '')
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

  async function handleAddRole() {
    if (!selectedTemplateId || savingRole) {
      return
    }

    setSavingRole(true)
    setError('')

    try {
      const res = await fetch(`/api/settings/templates/${selectedTemplateId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleForm),
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message ?? '新增角色失败')
        return
      }

      setRoleForm(EMPTY_ROLE_FORM)
      setActiveTab('roles')
      await Promise.all([loadTemplateRoles(selectedTemplateId), loadTemplates()])
    } catch {
      setError('新增角色失败')
    } finally {
      setSavingRole(false)
    }
  }

  async function handleDeleteRole() {
    if (!selectedTemplateId || !deletingRoleId) {
      return
    }

    try {
      const res = await fetch(`/api/settings/templates/${selectedTemplateId}/roles/${deletingRoleId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.success) {
        setError(json.error?.message ?? '删除角色失败')
        return
      }

      setDeletingRoleId(null)
      await Promise.all([loadTemplateRoles(selectedTemplateId), loadTemplates()])
    } catch {
      setError('删除角色失败')
    }
  }

  const selectedTemplate = templates.find((template) => template.templateId === selectedTemplateId) ?? null

  if (error) {
    return (
      <div className="p-4">
        <p className="mb-3 text-sm text-red-500">{error}</p>
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
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">模板</h1>
          <p className="text-sm text-text-secondary">查看和管理讨论模板</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-accent px-4 py-2 text-sm text-white"
            onClick={() => router.push(`/?templateId=${selectedTemplateId}`)}
            disabled={!selectedTemplateId}
          >
            使用模板
          </button>
        </div>
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
          <div className="mt-4 grid gap-2 text-sm text-text-secondary">
            <p>角色数：{selectedTemplate?.roleCount ?? 0}</p>
            <p>事件数：{selectedTemplate?.eventCount ?? 0}</p>
            <p>默认策略：{selectedTemplate?.defaultStrategy ?? 'smart_fallback'}</p>
            <p>配置状态：{selectedTemplate?.configStatus ?? 'default'}</p>
          </div>

          <div className="mt-4 grid gap-2 rounded-lg border border-border p-3">
            <label>
              角色名称
              <input
                aria-label="角色名称"
                value={roleForm.name}
                onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              角色画像
              <input
                aria-label="角色画像"
                value={roleForm.persona}
                onChange={(event) => setRoleForm((current) => ({ ...current, persona: event.target.value }))}
              />
            </label>
            <label>
              System Prompt
              <textarea
                aria-label="System Prompt"
                value={roleForm.systemPrompt}
                onChange={(event) => setRoleForm((current) => ({ ...current, systemPrompt: event.target.value }))}
              />
            </label>
            <label>
              Provider Connection
              <input
                aria-label="Provider Connection"
                value={roleForm.providerConnectionId}
                onChange={(event) => setRoleForm((current) => ({ ...current, providerConnectionId: event.target.value }))}
              />
            </label>
            <label>
              模型
              <input
                aria-label="模型"
                value={roleForm.model}
                onChange={(event) => setRoleForm((current) => ({ ...current, model: event.target.value }))}
              />
            </label>
            <button
              type="button"
              className="rounded-xl border border-border px-4 py-2 text-sm"
              onClick={() => void handleAddRole()}
              disabled={!selectedTemplateId || savingRole}
            >
              {savingRole ? '新增中...' : '新增角色'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          {roles.map((role) => (
            <div key={role.roleId} className="rounded-lg bg-background px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-text-primary">{role.name}</p>
                  <p className="mt-1 text-xs text-text-muted">{role.persona}</p>
                </div>
                <button type="button" onClick={() => setDeletingRoleId(role.roleId)}>
                  删除
                </button>
              </div>
              <div className="mt-3 grid gap-2">
                <label>
                  Provider Connection
                  <input
                    aria-label="Provider Connection"
                    readOnly
                    value={role.runtimeConfig?.providerConnectionId ?? ''}
                  />
                </label>
                <label>
                  模型
                  <input aria-label="模型" readOnly value={role.runtimeConfig?.model ?? ''} />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={deletingRoleId !== null}
        title="删除角色"
        message="确认删除该角色吗？"
        variant="danger"
        onConfirm={() => void handleDeleteRole()}
        onCancel={() => setDeletingRoleId(null)}
      />
    </div>
  )
}
