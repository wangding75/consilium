'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DiscussionTemplate, TemplateRole } from '@/types'
import type { CreateTemplateRoleRequest, TemplateListSettingsResult } from '@/types/api'
import { ConfirmDialog } from '@/modules/settings/ConfirmDialog'

type ActiveTab = 'detail' | 'roles'
type TemplateView = 'list' | 'detail'

type TemplateSettingsSummary = TemplateListSettingsResult['templates'][number]

const EMPTY_ROLE_FORM: CreateTemplateRoleRequest = {
  name: '',
  persona: '',
  systemPrompt: '',
  providerConnectionId: '',
  model: '',
  enabled: true,
}

const fieldLabel = 'block text-xs font-extrabold text-[#475569] mb-[6px]'
const fieldInput = 'w-full border border-[#dfe7f2] rounded-[13px] min-h-[44px] px-3 py-[10px] font-[inherit] text-[13px] outline-none bg-white text-text-primary'
const fieldTextarea = 'w-full border border-[#dfe7f2] rounded-[13px] min-h-[86px] px-3 py-[10px] font-[inherit] text-[13px] outline-none bg-white text-text-primary resize-none'

const listCard = 'w-full border border-[#e5eaf2] bg-white rounded-[20px] p-[13px] text-left shadow-[0_10px_26px_rgba(15,23,42,.04)] active:scale-[0.985]'
const cardName = 'text-[15px] font-extrabold text-text-primary'
const cardMeta = 'text-[11px] text-text-muted leading-relaxed mt-[5px]'
const tagOk = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-[#eaf9ef] text-green'
const tagWarn = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-[#fff7ed] text-[#d97706]'
const tagPurple = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-[#f5f3ff] text-purple'
const tagDefault = 'inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap bg-[#f1f5f9] text-[#64748b]'
const hintLink = 'text-[11px] text-primary font-bold mt-2'
const pill = 'text-[11px] text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-full py-1 px-2'

const sectionHead = 'flex items-center justify-between mt-[18px] mb-2 gap-[10px]'
const sectionTitle = 'text-[13px] font-extrabold text-text-primary'
const miniBtn = 'min-h-[34px] rounded-[13px] border border-[#e5eaf2] bg-white text-[#334155] text-xs font-extrabold px-[14px] active:scale-[0.98]'
const miniBtnSoft = 'min-h-[34px] rounded-[13px] border border-[#dbe7ff] bg-[#eef4ff] text-primary text-xs font-extrabold px-[14px] active:scale-[0.98]'
const btnPrimary = 'min-h-[44px] rounded-[13px] bg-primary text-white text-[13px] font-extrabold px-[14px] disabled:opacity-50'
const btnGhost = 'min-h-[44px] rounded-[13px] border border-[#e5eaf2] bg-white text-[#334155] text-[13px] font-extrabold px-[14px]'

const avatarColors: Record<string, string> = {
  host: 'bg-gradient-to-br from-[#f59e0b] to-[#854d0e]',
  zgl: 'bg-gradient-to-br from-[#10b981] to-[#166534]',
  cc: 'bg-gradient-to-br from-[#f97316] to-[#7f1d1d]',
}

function avatarClass(name: string): string {
  if (name.includes('主持')) return avatarColors.host
  if (name.includes('诸葛')) return avatarColors.zgl
  if (name.includes('曹')) return avatarColors.cc
  return 'bg-gradient-to-br from-[#60a5fa] to-[#7c3aed]'
}

function avatarChar(name: string): string {
  return name.charAt(0)
}

export function TemplatesModule() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateSettingsSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateDetail, setTemplateDetail] = useState<DiscussionTemplate | null>(null)
  const [roles, setRoles] = useState<TemplateRole[]>([])
  const [view, setView] = useState<TemplateView>('list')
  const [activeTab, setActiveTab] = useState<ActiveTab>('detail')
  const [error, setError] = useState('')
  const [roleForm, setRoleForm] = useState<CreateTemplateRoleRequest>(EMPTY_ROLE_FORM)
  const [savingRole, setSavingRole] = useState(false)
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)

  useEffect(() => { void loadTemplates() }, [])

  useEffect(() => {
    if (!selectedTemplateId) return
    if (activeTab === 'detail') { void loadTemplateDetail(selectedTemplateId); return }
    void loadTemplateRoles(selectedTemplateId)
  }, [selectedTemplateId, activeTab])

  async function loadTemplates() {
    setError('')
    try {
      const res = await fetch('/api/templates')
      const json = await res.json()
      if (!json.success) { setError(json.error?.message ?? '模板加载失败'); return }
      const nextTemplates = json.data.templates as TemplateListSettingsResult['templates']
      setTemplates(nextTemplates)
      setSelectedTemplateId((current) => current || nextTemplates[0]?.templateId || '')
    } catch { setError('模板加载失败') }
  }

  async function loadTemplateDetail(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}`)
      const json = await res.json()
      if (json.success) setTemplateDetail(json.data.template)
    } catch { setTemplateDetail(null) }
  }

  async function loadTemplateRoles(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}/roles`)
      const json = await res.json()
      if (json.success) setRoles(json.data.roles)
    } catch { setRoles([]) }
  }

  async function handleAddRole() {
    if (!selectedTemplateId || savingRole) return
    setSavingRole(true)
    setError('')
    try {
      const res = await fetch(`/api/settings/templates/${selectedTemplateId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleForm),
      })
      const json = await res.json()
      if (!json.success) { setError(json.error?.message ?? '新增角色失败'); return }
      setRoleForm(EMPTY_ROLE_FORM)
      setEditingRoleId(null)
      setActiveTab('roles')
      await Promise.all([loadTemplateRoles(selectedTemplateId), loadTemplates()])
    } catch { setError('新增角色失败') } finally { setSavingRole(false) }
  }

  async function handleDeleteRole() {
    if (!selectedTemplateId || !deletingRoleId) return
    try {
      const res = await fetch(`/api/settings/templates/${selectedTemplateId}/roles/${deletingRoleId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) { setError(json.error?.message ?? '删除角色失败'); return }
      setDeletingRoleId(null)
      await Promise.all([loadTemplateRoles(selectedTemplateId), loadTemplates()])
    } catch { setError('删除角色失败') }
  }

  const selectedTemplate = templates.find((t) => t.templateId === selectedTemplateId) ?? null
  const roleCount = selectedTemplate?.roleCount ?? 0
  const eventCount = selectedTemplate?.eventCount ?? 0
  const defaultStrategy = selectedTemplate?.defaultStrategy ?? 'smart_fallback'
  const configStatus = selectedTemplate?.configStatus ?? 'default'

  if (error) {
    return (
      <div className="p-4">
        <p className="mb-3 text-sm text-red">{error}</p>
        <button type="button" onClick={() => void loadTemplates()} className={miniBtn}>重试</button>
      </div>
    )
  }

  // Template list view
  if (view === 'list') {
    return (
      <div className="grid gap-[10px] p-4">
        {templates.map((template) => (
          <button
            key={template.templateId}
            type="button"
            className={listCard}
            onClick={() => { setSelectedTemplateId(template.templateId); setView('detail') }}
          >
            <div className="flex items-center justify-between gap-[10px]">
              <div>
                <div className={cardName}>{template.name}</div>
                <div className={cardMeta}>{template.roleCount ?? 0} 个角色 · {template.eventCount ?? 0} 个事件 · 默认策略：{template.defaultStrategy ?? 'smart_fallback'}</div>
              </div>
              <span className={configStatus === 'default' ? tagOk : configStatus === 'customized' ? tagPurple : tagOk}>
                {configStatus === 'default' ? '默认' : configStatus === 'customized' ? '已配置' : '已配置'}
              </span>
            </div>
            {template.roleCount > 0 && (
              <div className="flex gap-[6px] flex-wrap mt-[9px]">
                <span className={pill}>角色已配置</span>
                {template.defaultStrategy && <span className={pill}>{template.defaultStrategy}</span>}
                <span className={pill}>点此进入详情 ›</span>
              </div>
            )}
            <p className={hintLink}>点击整张卡片进入模板详情</p>
          </button>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-text-muted">暂无模板</p>
        )}
      </div>
    )
  }

  // Template detail view
  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-[10px] mt-3">
        <div className="border border-[#e5eaf2] rounded-[16px] p-3 bg-[#f8fafc]">
          <div className="text-[11px] text-text-muted">默认模型策略</div>
          <div className="mt-[6px] text-[15px] font-extrabold">{defaultStrategy}</div>
        </div>
        <div className="border border-[#e5eaf2] rounded-[16px] p-3 bg-[#f8fafc]">
          <div className="text-[11px] text-text-muted">角色数量</div>
          <div className="mt-[6px] text-[15px] font-extrabold">{roleCount} 个角色</div>
        </div>
      </div>

      <div className={sectionHead}>
        <div className={sectionTitle}>模板基础配置</div>
        <button type="button" className={miniBtn}>编辑基础信息</button>
      </div>

      <div className={`${listCard} !cursor-default`}>
        <div className="flex items-center justify-between gap-[10px]">
          <div>
            <div className={cardName}>策略与节奏</div>
            <div className={cardMeta}>质量与成本平衡；高潮阶段允许更长输出</div>
          </div>
          <span className={tagPurple}>已配置</span>
        </div>
        <div className="flex gap-[6px] flex-wrap mt-[9px]">
          <span className={pill}>fallback：自动</span>
          <span className={pill}>事件：{eventCount}</span>
          <span className={pill}>节奏规则：1 套</span>
        </div>
      </div>

      <div className={sectionHead}>
        <div className={sectionTitle}>角色配置</div>
        <button type="button" onClick={() => setEditingRoleId('new')} className={miniBtnSoft}>＋ 新增角色</button>
      </div>

      <div className="grid gap-[10px]">
        {roles.map((role) => (
          <button
            key={role.roleId}
            type="button"
            className={`${listCard}`}
            onClick={() => setEditingRoleId(editingRoleId === role.roleId ? null : role.roleId)}
          >
            <div className="flex items-start gap-[10px]">
              <div className={`w-[38px] h-[38px] rounded-full grid place-items-center text-[13px] font-extrabold text-white flex-shrink-0 ${avatarClass(role.name)}`}>
                {avatarChar(role.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-[10px]">
                  <div className={cardName}>{role.name}</div>
                  <span className={role.runtimeConfig?.providerConnectionId ? tagOk : tagWarn}>
                    {role.runtimeConfig?.providerConnectionId ? '已配置' : '待配置'}
                  </span>
                </div>
                <div className={cardMeta}>
                  模型：{role.runtimeConfig?.model || '未设置'}
                </div>
                <div className="flex gap-[6px] flex-wrap mt-[9px]">
                  <span className={pill}>Prompt：{role.systemPrompt ? '已配置' : '未配置'}</span>
                  <span className={pill}>点此编辑 ›</span>
                </div>
                <p className={hintLink}>点击整张角色卡进入角色编辑页</p>

                {editingRoleId === role.roleId && (
                  <div className="grid gap-3 mt-3 pt-3 border-t border-[#eef2f7]" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className={fieldLabel}>角色名称</label>
                      <input className={fieldInput} value={roleForm.name} onChange={(e) => setRoleForm((c) => ({ ...c, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className={fieldLabel}>角色定位</label>
                      <input className={fieldInput} value={roleForm.persona} onChange={(e) => setRoleForm((c) => ({ ...c, persona: e.target.value }))} />
                    </div>
                    <div>
                      <label className={fieldLabel}>连接来源</label>
                      <input className={fieldInput} value={roleForm.providerConnectionId} onChange={(e) => setRoleForm((c) => ({ ...c, providerConnectionId: e.target.value }))} placeholder="Provider Connection ID" />
                    </div>
                    <div>
                      <label className={fieldLabel}>模型</label>
                      <input className={fieldInput} value={roleForm.model} onChange={(e) => setRoleForm((c) => ({ ...c, model: e.target.value }))} placeholder="模型名称" />
                    </div>
                    <div>
                      <label className={fieldLabel}>System Prompt</label>
                      <textarea className={fieldTextarea} value={roleForm.systemPrompt} onChange={(e) => setRoleForm((c) => ({ ...c, systemPrompt: e.target.value }))} />
                    </div>
                    <div className="flex items-center justify-between border border-[#e5eaf2] rounded-[13px] px-3 py-[11px] text-[13px] font-semibold bg-white">
                      <span>是否参与默认发言队列</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={roleForm.enabled}
                        onClick={() => setRoleForm((c) => ({ ...c, enabled: !c.enabled }))}
                        className={`relative w-[42px] h-6 rounded-full transition-colors ${roleForm.enabled ? 'bg-primary' : 'bg-[#cbd5e1]'}`}
                      >
                        <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${roleForm.enabled ? 'right-[3px]' : 'left-[3px]'}`} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-[10px]">
                      <button type="button" className="min-h-[34px] rounded-[13px] border border-[#e5eaf2] bg-white text-[#334155] text-xs font-extrabold px-[14px]">复制角色</button>
                      <button
                        type="button"
                        className="min-h-[34px] rounded-[13px] border border-[#e5eaf2] bg-white text-[#334155] text-xs font-extrabold px-[14px]"
                        onClick={() => setDeletingRoleId(role.roleId)}
                      >
                        删除角色
                      </button>
                      <button type="button" onClick={() => void handleAddRole()} disabled={savingRole} className="min-h-[44px] rounded-[13px] bg-primary text-white text-[13px] font-extrabold px-[14px] disabled:opacity-50">
                        {savingRole ? '保存中...' : '保存角色'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}

        {editingRoleId === 'new' && (
          <div className={`${listCard} border-primary`}>
            <div className="grid gap-3" onClick={(e) => e.stopPropagation()}>
              <div>
                <label className={fieldLabel}>角色名称</label>
                <input className={fieldInput} value={roleForm.name} onChange={(e) => setRoleForm((c) => ({ ...c, name: e.target.value }))} placeholder="例如：周瑜" />
              </div>
              <div>
                <label className={fieldLabel}>角色定位</label>
                <input className={fieldInput} value={roleForm.persona} onChange={(e) => setRoleForm((c) => ({ ...c, persona: e.target.value }))} placeholder="战略统筹 / 节奏把控 / 对抗思维" />
              </div>
              <div>
                <label className={fieldLabel}>连接来源</label>
                <input className={fieldInput} value={roleForm.providerConnectionId} onChange={(e) => setRoleForm((c) => ({ ...c, providerConnectionId: e.target.value }))} placeholder="Provider Connection ID" />
              </div>
              <div>
                <label className={fieldLabel}>模型</label>
                <input className={fieldInput} value={roleForm.model} onChange={(e) => setRoleForm((c) => ({ ...c, model: e.target.value }))} placeholder="例如：gpt-4.1-mini" />
              </div>
              <div>
                <label className={fieldLabel}>System Prompt</label>
                <textarea className={fieldTextarea} value={roleForm.systemPrompt} onChange={(e) => setRoleForm((c) => ({ ...c, systemPrompt: e.target.value }))} placeholder="输入角色的 System Prompt..." />
              </div>
              <div className="flex items-center justify-between border border-[#e5eaf2] rounded-[13px] px-3 py-[11px] text-[13px] font-semibold bg-white">
                <span>创建后立即启用</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={roleForm.enabled}
                  onClick={() => setRoleForm((c) => ({ ...c, enabled: !c.enabled }))}
                  className={`relative w-[42px] h-6 rounded-full transition-colors ${roleForm.enabled ? 'bg-primary' : 'bg-[#cbd5e1]'}`}
                >
                  <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${roleForm.enabled ? 'right-[3px]' : 'left-[3px]'}`} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-[10px]">
                <button type="button" onClick={() => { setEditingRoleId(null); setRoleForm(EMPTY_ROLE_FORM) }} className={btnGhost}>取消</button>
                <button type="button" onClick={() => void handleAddRole()} disabled={savingRole} className={btnPrimary}>
                  {savingRole ? '保存中...' : '保存新增'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button type="button" onClick={() => setView('list')} className={miniBtn}>← 返回模板列表</button>
        <button type="button" onClick={() => router.push(`/?templateId=${selectedTemplateId}`)} disabled={!selectedTemplateId} className={`${btnPrimary} ml-2`}>
          使用模板
        </button>
      </div>

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