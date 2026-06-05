'use client'

import React, { useState } from 'react'

export interface ProviderSheetProps {
  isOpen: boolean
  providerId: string
  onClose: () => void
  onSaved: () => void
}

export function ProviderSheet({ isOpen, providerId, onClose, onSaved: _onSaved }: ProviderSheetProps): React.ReactElement | null {
  const [enabled, setEnabled] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelList, setModelList] = useState('')
  const [customHeaders, setCustomHeaders] = useState('')
  const [baseUrlError, setBaseUrlError] = useState('')
  const [headersError, setHeadersError] = useState('')

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

  const isSaveDisabled = !providerId || modelList.trim() === ''

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
      <button disabled={isSaveDisabled}>保存</button>
      <button>测试连接</button>
    </div>
  )
}

export default ProviderSheet