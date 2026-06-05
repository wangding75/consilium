'use client'

import React, { useEffect, useState } from 'react'

export interface ModelSheetProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

interface ProviderInfo {
  providerId: string
  enabled: boolean
}

interface RoleOverride {
  roleId: string
  providerId: string
  model: string
  temperature: number
  maxTokens: number
}

export function ModelSheet({ isOpen, onClose, onSaved }: ModelSheetProps): React.ReactElement | null {
  const [loading, setLoading] = useState(true)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [model, setModel] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(512)
  const [overrides, setOverrides] = useState<RoleOverride[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    async function load() {
      setLoading(true)
      try {
        const [provRes, defaultsRes, overridesRes, templatesRes] = await Promise.all([
          fetch('/api/llm/providers'),
          fetch('/api/settings/model-defaults'),
          fetch('/api/settings/role-models'),
          fetch('/api/templates'),
        ])

        const provBody = await provRes.json()
        if (provBody.success) {
          setProviders(provBody.data)
        }

        const defaultsBody = await defaultsRes.json()
        if (defaultsBody.success && defaultsBody.data) {
          setSelectedProvider(defaultsBody.data.providerId)
          setModel(defaultsBody.data.model)
          setTemperature(defaultsBody.data.temperature)
          setMaxTokens(defaultsBody.data.maxTokens)
        }

        const overridesBody = await overridesRes.json()
        if (overridesBody.success && Array.isArray(overridesBody.data)) {
          setOverrides(overridesBody.data)
        }

        const templatesBody = await templatesRes.json()
        if (templatesBody.success && templatesBody.data?.templates) {
          const allRoles: string[] = []
          for (const tpl of templatesBody.data.templates) {
            for (const role of tpl.roles) {
              if (!allRoles.includes(role.id)) {
                allRoles.push(role.id)
              }
            }
          }
          setRoles(allRoles)
        } else {
          setRoles(overridesBody.data?.map((o: RoleOverride) => o.roleId) ?? [])
        }
      } catch {
        // keep defaults
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [isOpen])

  if (!isOpen) return null

  const enabledProviders = providers.filter((p) => p.enabled)
  const hasEnabledProviders = enabledProviders.length > 0

  const handleSaveDefaults = async () => {
    if (!hasEnabledProviders) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/model-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProvider,
          model,
          temperature,
          maxTokens,
        }),
      })
      const body = await res.json()
      if (body.success) {
        onSaved()
      }
    } catch {
      // keep state
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }

  const handleClearOverride = async (roleId: string) => {
    const updated = overrides.filter((o) => o.roleId !== roleId)
    setOverrides(updated)
    try {
      await fetch('/api/settings/role-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: updated }),
      })
      onSaved()
    } catch {
      // keep state
    }
  }

  return (
    <div role="dialog">
      <h2>模型配置</h2>
      <button onClick={onClose} aria-label="关闭">✕</button>

      {loading ? (
        <p>加载中...</p>
      ) : (
        <>
          <section>
            <h3>全局默认模型</h3>
            {hasEnabledProviders ? (
              <>
                <div>
                  <label htmlFor="globalProvider">Provider</label>
                  <select
                    id="globalProvider"
                    role="combobox"
                    aria-label="Provider"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                  >
                    {enabledProviders.map((p) => (
                      <option key={p.providerId} value={p.providerId}>
                        {p.providerId}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="globalModel">Model</label>
                  <input
                    id="globalModel"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    aria-label="model"
                  />
                </div>
                <div>
                  <label htmlFor="globalTemperature">Temperature</label>
                  <input
                    id="globalTemperature"
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    aria-label="temperature"
                  />
                </div>
                <div>
                  <label htmlFor="globalMaxTokens">Max Tokens</label>
                  <input
                    id="globalMaxTokens"
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                    aria-label="max tokens"
                  />
                </div>
              </>
            ) : (
              <p>暂无可用 Provider</p>
            )}
            <button
              disabled={!hasEnabledProviders || saving}
              onClick={handleSaveDefaults}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </section>

          {hasEnabledProviders && (
            <section>
              <h3>角色覆盖</h3>
              {roles.length > 0 ? (
                <ul>
                  {roles.map((roleId) => {
                    const override = overrides.find((o) => o.roleId === roleId)
                    const isExpanded = expandedRoles.has(roleId)
                    return (
                      <li key={roleId}>
                        <button onClick={() => toggleRole(roleId)}>
                          {roleId}
                        </button>
                        {isExpanded && (
                          <div>
                            {override ? (
                              <>
                                <p>Provider: {override.providerId}</p>
                                <p>Model: {override.model}</p>
                                <p>Temperature: {override.temperature}</p>
                                <p>Max Tokens: {override.maxTokens}</p>
                                <button onClick={() => handleClearOverride(roleId)}>
                                  清除覆盖
                                </button>
                              </>
                            ) : (
                              <p>使用全局默认</p>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p>暂无角色数据</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default ModelSheet