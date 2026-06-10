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
  if (value.trim() === '') {
    return undefined
  }

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

  if (form.id) {
    return payload
  }

  return {
    providerType: form.providerType,
    ...payload,
  }
}

export function ProviderSheet({ isOpen, providerId, onClose, onSaved }: ProviderSheetProps): React.ReactElement | null {
  const [connections, setConnections] = useState<ProviderConnectionDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelList, setModelList] = useState('')
  const [customHeaders, setCustomHeaders] = useState(EMPTY_HEADERS)
  const [baseUrlError, setBaseUrlError] = useState('')
  const [headersError, setHeadersError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testLatency, setTestLatency] = useState('')
  const [selectedConnectionId, setSelectedConnectionId] = useState('')

  const visibleConnections = useMemo(
    () => connections.filter((connection) => connection.providerType === providerId),
    [connections, providerId]
  )

  const syncForm = (form: ConnectionFormState) => {
    setSelectedConnectionId(form.id ?? '')
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
      const res = await fetch('/api/settings/provider-connections', {
        method: 'GET',
      })
      const body = await res.json()
      if (body.success) {
        const nextConnections = body.data?.connections ?? []
        setConnections(nextConnections)
        const firstMatch = nextConnections.find((connection: ProviderConnectionDTO) => connection.providerType === providerId)
        syncForm(firstMatch ? toFormState(firstMatch) : createEmptyForm(providerId))
      }
    } catch {
      setConnections([])
      syncForm(createEmptyForm(providerId))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    void loadConnections()
  }, [isOpen, providerId])

  if (!isOpen) return null

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBaseUrl(value)

    if (!value.trim()) {
      setBaseUrlError('')
      return
    }

    try {
      new URL(value)
      setBaseUrlError('')
    } catch {
      setBaseUrlError('格式无效')
    }
  }

  const handleHeadersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCustomHeaders(value)

    if (value.trim() === '') {
      setHeadersError('')
      return
    }

    try {
      JSON.parse(value)
      setHeadersError('')
    } catch {
      setHeadersError('JSON 格式错误')
    }
  }

  const isSaveDisabled = modelList.trim() === '' || !!baseUrlError || !!headersError || saving

  const handleSave = async () => {
    if (isSaveDisabled || !providerId) {
      return
    }

    setSaving(true)
    setSaveError('')

    try {
      const payload = buildSavePayload({
        id: selectedConnectionId || undefined,
        providerType: providerId as ProviderType,
        displayName,
        baseUrl,
        apiKey,
        modelList,
        customHeaders,
        enabled,
      })
      const method = selectedConnectionId ? 'PATCH' : 'POST'
      const endpoint = selectedConnectionId
        ? `/api/settings/provider-connections/${selectedConnectionId}`
        : '/api/settings/provider-connections'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json()

      if (body.success) {
        await loadConnections()
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
    if (!providerId || !apiKey) return

    setTesting(true)
    setTestResult('')
    setTestLatency('')

    try {
      const firstModel = modelList.split(',').map((item) => item.trim()).filter(Boolean)[0]
      const payload = {
        providerType: providerId as ProviderType,
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

  return (
    <div role="dialog" className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2>Provider 配置</h2>
        <button onClick={onClose} aria-label="关闭">✕</button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">已保存连接</p>
          <p className="text-xs text-text-secondary">按厂商查看并复用已有连接。</p>
        </div>
        <button type="button" onClick={() => syncForm(createEmptyForm(providerId))} aria-label="新增连接">+</button>
      </div>

      {loading ? <p>加载中...</p> : null}

      <div className="space-y-2">
        {visibleConnections.map((connection) => (
          <button
            key={connection.id}
            type="button"
            className="w-full rounded-lg border border-border p-3 text-left"
            onClick={() => syncForm(toFormState(connection))}
          >
            <div className="flex items-center justify-between gap-3">
              <p>{connection.displayName}</p>
              <span>{connection.enabled ? '已启用' : '未启用'}</span>
            </div>
            <p>{connection.modelList.join(', ')}</p>
            {connection.maskedKey ? <p>{connection.maskedKey}</p> : null}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="providerId">厂商 ID</label>
        <input id="providerId" value={providerId} readOnly />
      </div>
      <div>
        <label htmlFor="displayName">连接名称</label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-label="连接名称"
        />
      </div>
      <div>
        <label htmlFor="enabled">
          <input
            id="enabled"
            type="checkbox"
            role="checkbox"
            aria-label="启用"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          启用
        </label>
      </div>
      <div>
        <label htmlFor="baseUrl">Base 地址</label>
        <input
          id="baseUrl"
          value={baseUrl}
          onChange={handleBaseUrlChange}
          aria-label="Base URL"
        />
        {baseUrlError && <p>{baseUrlError}</p>}
      </div>
      <div>
        <label htmlFor="apiKey">API Key</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          aria-label="API Key"
        />
      </div>
      <div>
        <label htmlFor="modelList">Model 列表</label>
        <input
          id="modelList"
          value={modelList}
          onChange={(e) => setModelList(e.target.value)}
          aria-label="model list"
        />
      </div>
      <div>
        <label htmlFor="customHeaders">Custom Header</label>
        <input
          id="customHeaders"
          value={customHeaders}
          onChange={handleHeadersChange}
          aria-label="custom header"
        />
        {headersError && <p>{headersError}</p>}
      </div>
      <button disabled={isSaveDisabled} onClick={handleSave}>{saving ? '保存中...' : '保存'}</button>
      <button disabled={!providerId || !apiKey || testing} onClick={handleTest}>{testing ? '测试中...' : '测试连接'}</button>
      {saveError && <p>{saveError}</p>}
      {testResult && <p>{testResult}</p>}
      {testLatency && <p>{testLatency}</p>}
    </div>
  )
}

export default ProviderSheet
