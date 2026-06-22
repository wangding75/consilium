'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { ProviderType } from '@/types'
import type {
  CreateProviderConnectionRequest,
  ProviderConnectionDTO,
  ProviderConnectionTestResult,
  UpdateProviderConnectionRequest,
} from '@/types/api'

export interface ProviderSheetProps {
  isOpen: boolean
  providerId: string
  onClose: () => void
  onSaved: () => void
}

interface ConnectionFormState {
  id?: string
  providerType: ProviderType
  displayName: string
  baseUrl: string
  apiKey: string
  modelList: string
  customHeaders: string
  enabled: boolean
}

const EMPTY_HEADERS = '{}'

function createEmptyForm(providerType: string): ConnectionFormState {
  return {
    providerType: providerType as ProviderType,
    displayName: '',
    baseUrl: '',
    apiKey: '',
    modelList: '',
    customHeaders: EMPTY_HEADERS,
    enabled: true,
  }
}

function toFormState(connection: ProviderConnectionDTO): ConnectionFormState {
  return {
    id: connection.id,
    providerType: connection.providerType,
    displayName: connection.displayName,
    baseUrl: connection.baseUrl,
    apiKey: '',
    modelList: connection.modelList.join(', '),
    customHeaders: JSON.stringify(connection.maskedHeaders ?? {}, null, 2),
    enabled: connection.enabled,
  }
}

function parseHeaders(value: string): Record<string, string> | undefined {
  if (value.trim() === '') return undefined
  return JSON.parse(value) as Record<string, string>
}

function buildSavePayload(form: ConnectionFormState): CreateProviderConnectionRequest | UpdateProviderConnectionRequest {
  const payload = {
    displayName: form.displayName,
    baseUrl: form.baseUrl,
    apiKey: form.apiKey || undefined,
    modelList: form.modelList.split(',').map((item) => item.trim()).filter(Boolean),
    customHeaders: parseHeaders(form.customHeaders),
    enabled: form.enabled,
  }
  if (form.id) return payload
  return { providerType: form.providerType, ...payload }
}

const fieldLabel = 'block text-xs font-extrabold text-[#475569] mb-[6px]'
const fieldInput = 'w-full border border-[#dfe7f2] rounded-[13px] min-h-[44px] px-3 py-[10px] font-[inherit] text-[13px] outline-none bg-white text-text-primary'
const fieldTextarea = 'w-full border border-[#dfe7f2] rounded-[13px] min-h-[86px] px-3 py-[10px] font-[inherit] text-[13px] outline-none bg-white text-text-primary resize-none'

export function ProviderSheet({ isOpen, providerId, onClose, onSaved }: ProviderSheetProps): React.ReactElement | null {
  const [connections, setConnections] = useState<ProviderConnectionDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'list' | 'edit'>('list')

  // form state
  const [formId, setFormId] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelList, setModelList] = useState('')
  const [customHeaders, setCustomHeaders] = useState(EMPTY_HEADERS)
  const [providerType, setProviderType] = useState<ProviderType>('openai')
  const [baseUrlError, setBaseUrlError] = useState('')
  const [headersError, setHeadersError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testLatency, setTestLatency] = useState('')

  const visibleConnections = useMemo(
    () => connections.filter((connection) => connection.providerType === providerId),
    [connections, providerId]
  )

  const syncForm = (form: ConnectionFormState) => {
    setFormId(form.id ?? '')
    setProviderType(form.providerType)
    setEnabled(form.enabled)
    setDisplayName(form.displayName)
    setBaseUrl(form.baseUrl)
    setApiKey(form.apiKey)
    setModelList(form.modelList)
    setCustomHeaders(form.customHeaders)
    setBaseUrlError('')
    setHeadersError('')
    setSaveError('')
    setTestResult('')
    setTestLatency('')
  }

  const loadConnections = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/provider-connections', { method: 'GET' })
      const body = await res.json()
      if (body.success) {
        setConnections(body.data?.connections ?? [])
      }
    } catch {
      setConnections([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    void loadConnections()
  }, [isOpen, providerId])

  if (!isOpen) return null

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBaseUrl(value)
    if (!value.trim()) { setBaseUrlError(''); return }
    try { new URL(value); setBaseUrlError('') } catch { setBaseUrlError('格式无效') }
  }

  const handleHeadersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomHeaders(value)
    if (value.trim() === '') { setHeadersError(''); return }
    try { JSON.parse(value); setHeadersError('') } catch { setHeadersError('JSON 格式错误') }
  }

  const isSaveDisabled = modelList.trim() === '' || !!baseUrlError || !!headersError || saving

  const handleSave = async () => {
    if (isSaveDisabled) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = buildSavePayload({
        id: formId || undefined,
        providerType,
        displayName,
        baseUrl,
        apiKey,
        modelList,
        customHeaders,
        enabled,
      })
      const method = formId ? 'PATCH' : 'POST'
      const endpoint = formId
        ? `/api/settings/provider-connections/${formId}`
        : '/api/settings/provider-connections'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (body.success) {
        await loadConnections()
        setMode('list')
        onSaved()
      } else {
        setSaveError('保存失败')
      }
    } catch {
      setSaveError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!apiKey) return
    setTesting(true)
    setTestResult('')
    setTestLatency('')
    try {
      const firstModel = modelList.split(',').map((item) => item.trim()).filter(Boolean)[0]
      const payload = {
        providerType,
        apiKey,
        ...(firstModel ? { model: firstModel } : {}),
        ...(baseUrl.trim() && !baseUrlError ? { baseUrl: baseUrl.trim() } : {}),
      }
      const res = await fetch('/api/settings/provider-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (body.success) {
        const result = body.data as ProviderConnectionTestResult
        setTestResult(result.status)
        setTestLatency(result.latencyMs ? `${result.latencyMs}ms` : '')
      } else {
        setTestResult('操作失败')
      }
    } catch {
      setTestResult('操作失败')
    } finally {
      setTesting(false)
    }
  }

  const openNew = () => {
    syncForm(createEmptyForm(providerId))
    setMode('edit')
  }

  const openEdit = (connection: ProviderConnectionDTO) => {
    syncForm(toFormState(connection))
    setMode('edit')
  }

  if (mode === 'edit') {
    return (
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); void handleSave() }}>
        <div>
          <label className={fieldLabel}>厂商类型</label>
          <select
            className={fieldInput}
            value={providerType}
            onChange={(e) => setProviderType(e.target.value as ProviderType)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className={fieldLabel}>连接名称</label>
          <input
            className={fieldInput}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabel}>Base URL</label>
          <input
            className={fieldInput}
            value={baseUrl}
            onChange={handleBaseUrlChange}
          />
          {baseUrlError && <p className="text-xs text-red mt-[6px]">{baseUrlError}</p>}
        </div>
        <div>
          <label className={fieldLabel}>API Key</label>
          <input
            className={fieldInput}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          {!formId && <p className="text-[11px] text-text-muted leading-relaxed mt-[6px]">新增时允许空白起步；保存后默认脱敏展示。</p>}
          {formId && <p className="text-[11px] text-text-muted leading-relaxed mt-[6px]">编辑页仅展示脱敏值；重新保存前可覆盖更新。</p>}
        </div>
        <div>
          <label className={fieldLabel}>Model 列表</label>
          <textarea
            className={fieldTextarea}
            value={modelList}
            onChange={(e) => setModelList(e.target.value)}
          />
        </div>
        <div>
          <label className={fieldLabel}>Custom Header</label>
          <textarea
            className={fieldTextarea}
            value={customHeaders}
            onChange={(e) => { setCustomHeaders(e.target.value); setHeadersError('') }}
          />
          {headersError && <p className="text-xs text-red mt-[6px]">{headersError}</p>}
        </div>
        <div className="flex items-center justify-between border border-[#e5eaf2] rounded-[13px] px-3 py-[11px] text-[13px] font-semibold bg-white">
          <span>启用该连接</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative w-[42px] h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-[#cbd5e1]'}`}
          >
            <span className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all ${enabled ? 'right-[3px]' : 'left-[3px]'}`} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-[10px] mt-1">
          {formId && (
            <button type="button" className="min-h-[34px] rounded-[13px] border border-[#e5eaf2] bg-white text-[#334155] text-xs font-extrabold px-[14px]">
              删除
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={!apiKey || testing}
            className="min-h-[34px] rounded-[13px] border border-[#dbe7ff] bg-[#eef4ff] text-primary text-xs font-extrabold px-[14px] disabled:opacity-50"
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            type="submit"
            disabled={isSaveDisabled}
            className="min-h-[44px] rounded-[13px] bg-primary text-white text-[13px] font-extrabold px-[14px] disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMode('list')} className="min-h-[34px] rounded-[13px] border border-[#e5eaf2] bg-white text-[#334155] text-xs font-extrabold px-[14px]">
            返回列表
          </button>
          {saveError && <p className="text-xs text-red">{saveError}</p>}
          {testResult && <p className="text-xs text-green">{testResult}{testLatency ? ` · ${testLatency}` : ''}</p>}
        </div>
      </form>
    )
  }

  // list mode
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-text-muted">共 {visibleConnections.length} 个连接</p>
        <button
          type="button"
          onClick={openNew}
          className="w-9 h-9 rounded-full border border-[#e5eaf2] bg-white grid place-items-center text-xl text-primary font-extrabold active:scale-[0.98]"
        >
          ＋
        </button>
      </div>

      {loading ? <p className="text-sm text-text-muted">加载中...</p> : null}

      <div className="grid gap-[10px]">
        {visibleConnections.map((connection) => (
          <button
            key={connection.id}
            type="button"
            onClick={() => openEdit(connection)}
            className="w-full border border-[#e5eaf2] bg-white rounded-[20px] p-[13px] text-left shadow-[0_10px_26px_rgba(15,23,42,.04)] active:scale-[0.985]"
          >
            <div className="flex items-center justify-between gap-[10px]">
              <div>
                <div className="text-[15px] font-extrabold text-text-primary">{connection.displayName}</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-[5px]">
                  {connection.baseUrl} · {connection.modelList.length} 个模型
                </div>
              </div>
              <span className={`inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap ${connection.enabled ? 'bg-[#eaf9ef] text-green' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
                {connection.enabled ? '已启用' : '未启用'}
              </span>
            </div>
            <div className="flex gap-[6px] flex-wrap mt-[9px]">
              {connection.modelList.slice(0, 3).map((model) => (
                <span key={model} className="text-[11px] text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-full py-1 px-2">{model}</span>
              ))}
              <span className="text-[11px] text-[#475569] bg-[#f8fafc] border border-[#e2e8f0] rounded-full py-1 px-2">点此编辑 ›</span>
            </div>
            <p className="mt-2 text-[11px] text-primary font-bold">点击整张卡片进入编辑页面</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default ProviderSheet