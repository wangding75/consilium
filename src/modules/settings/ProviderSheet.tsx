'use client'

import React, { useState } from 'react'

export interface ProviderSheetProps {
  isOpen: boolean
  providerId: string
  onClose: () => void
  onSaved: () => void
}

export function ProviderSheet({ isOpen, providerId, onClose, onSaved }: ProviderSheetProps): React.ReactElement | null {
  const [enabled, setEnabled] = useState(true)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelList, setModelList] = useState('')
  const [customHeaders, setCustomHeaders] = useState('')
  const [baseUrlError, setBaseUrlError] = useState('')
  const [headersError, setHeadersError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [testResult, setTestResult] = useState('')
  const [testLatency, setTestLatency] = useState('')

  if (!isOpen) return null

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setBaseUrl(val)
    try {
      new URL(val)
      setBaseUrlError('')
    } catch {
      setBaseUrlError('格式无效')
    }
  }

  const handleHeadersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCustomHeaders(val)
    if (val.trim() === '') {
      setHeadersError('')
      return
    }
    try {
      JSON.parse(val)
      setHeadersError('')
    } catch {
      setHeadersError('JSON 格式错误')
    }
  }

  const isSaveDisabled = !providerId || modelList.trim() === '' || !!baseUrlError || !!headersError || saving

  const handleSave = async () => {
    if (isSaveDisabled || baseUrlError) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/llm/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          enabled,
          baseUrl,
          apiKey,
          modelList: modelList.split(',').map((s) => s.trim()).filter(Boolean),
          customHeaders: customHeaders ? JSON.parse(customHeaders) : undefined,
        }),
      })
      const body = await res.json()
      if (body.success) {
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
      const res = await fetch('/api/llm/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey }),
      })
      const body = await res.json()
      if (body.success) {
        setTestResult('success')
        setTestLatency(body.data?.latencyMs ? `${body.data.latencyMs}ms` : '')
      } else {
        const code = body.error?.code
        if (code === 'PROVIDER_AUTH_FAILED') {
          setTestResult('API Key 验证失败')
        } else if (code === 'PROVIDER_NOT_CONFIGURED') {
          setTestResult('Provider 尚未配置')
        } else {
          setTestResult('操作失败')
        }
      }
    } catch {
      setTestResult('操作失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div role="dialog">
      <h2>Provider 配置</h2>
      <div>
        <label htmlFor="providerId">厂商 ID</label>
        <input id="providerId" value={providerId} readOnly />
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
      <button onClick={onClose} aria-label="关闭">✕</button>
      <button disabled={isSaveDisabled} onClick={handleSave}>{saving ? '保存中...' : '保存'}</button>
      <button disabled={!providerId || !apiKey || testing} onClick={handleTest}>{testing ? '测试中...' : '测试连接'}</button>
      {saveError && <p>{saveError}</p>}
      {testResult && <p>{testResult}</p>}
      {testLatency && <p>{testLatency}</p>}
    </div>
  )
}

export default ProviderSheet