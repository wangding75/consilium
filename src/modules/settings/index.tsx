'use client'

import { useEffect, useState } from 'react'
import type { ProviderStatusDTO, ModelDefaultsDTO } from '@/types/api'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'
import { ModelSheet } from '@/modules/settings/ModelSheet'
import { PromptSheet } from '@/modules/settings/PromptSheet'
import { DataCleanupSheet } from '@/modules/settings/DataCleanupSheet'

const ALL_PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']

type ActiveSheet = 'provider' | 'model' | 'prompt' | 'cleanup' | null

export function SettingsModule() {
  const [providers, setProviders] = useState<ProviderStatusDTO[]>([])
  const [modelDefaults, setModelDefaults] = useState<ModelDefaultsDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)
  const [selectedProviderId, setSelectedProviderId] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [providersRes, defaultsRes] = await Promise.all([
        fetch('/api/llm/providers'),
        fetch('/api/settings/model-defaults'),
      ])
      if (providersRes.ok) {
        const body = await providersRes.json()
        if (body.success) setProviders(body.data)
      }
      if (defaultsRes.ok) {
        const body = await defaultsRes.json()
        if (body.success) setModelDefaults(body.data)
      }
    } catch {
      // network error — keep existing state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleProviderClick = (providerId: string) => {
    setSelectedProviderId(providerId)
    setActiveSheet('provider')
  }

  const handleProviderSaved = () => {
    loadData()
  }

  const handleModelSaved = () => {
    loadData()
  }

  const handlePromptSaved = () => {
    loadData()
  }

  const displayProviders = ALL_PROVIDER_IDS.map((id) => {
    const existing = providers.find((p) => p.providerId === id)
    return existing ?? {
      providerId: id,
      enabled: false,
      baseUrl: '',
      maskedKey: undefined,
      modelList: [],
      maskedHeaders: {},
      lastTestStatus: 'untested',
    } as ProviderStatusDTO
  })

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-text-primary mb-2">设置</h1>
      <p className="text-text-secondary text-sm mb-6">配置 LLM 厂商与运行参数</p>

      <div className="space-y-4 mb-6">
        {/* Provider section */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Provider 厂商与连接</h2>
          {loading ? (
            <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">加载中...</div>
          ) : (
            <div className="space-y-2">
              {displayProviders.map((p) => (
                <div
                  key={p.providerId}
                  className="rounded-xl border border-border p-3 flex items-center justify-between cursor-pointer"
                  onClick={() => handleProviderClick(p.providerId)}
                >
                  <div>
                    <div className="font-medium text-text-primary">{p.providerId}</div>
                    <div className="text-xs text-text-muted">
                      {p.maskedKey ? `Key: ${p.maskedKey}` : '未提供'} · {p.modelList.length} 个
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.lastTestStatus === 'success' ? 'bg-green-100 text-green-700' :
                      p.lastTestStatus === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {p.lastTestStatus === 'success' ? '已连接' : p.lastTestStatus === 'failed' ? '连接失败' : '未测试'}
                    </span>
                    {p.enabled ? (
                      <span className="text-xs text-green-600">已启用</span>
                    ) : (
                      <span className="text-xs text-text-muted">未配置</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Model section */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">模型配置</h2>
          <div className="rounded-xl border border-border p-3 flex items-center justify-between">
            <div>
              {modelDefaults ? (
                <div className="text-sm text-text-primary">
                  <div>{modelDefaults.model}</div>
                  <div className="text-xs text-text-muted">优先级：角色专属 &gt; 全局默认</div>
                  <div>温度: {modelDefaults.temperature} · 最大 Tokens: {modelDefaults.maxTokens}</div>
                </div>
              ) : (
                <div className="text-text-muted text-sm">未设置全局默认模型</div>
              )}
            </div>
            <button className="text-sm text-primary" onClick={() => setActiveSheet('model')}>编辑</button>
          </div>
        </section>

        {/* Template section (placeholder) */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">模板管理 Template</h2>
          <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
            <p>该功能将在后续迭代中提供</p>
            <button disabled className="mt-2 text-sm text-text-muted">了解更多</button>
          </div>
        </section>

        {/* Prompt section */}
        <section onClick={() => setActiveSheet('prompt')}>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Prompt 提示词配置</h2>
          <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
            配置占位 — 点击编辑
          </div>
        </section>

        {/* Data / Security section */}
        <section onClick={() => setActiveSheet('cleanup')}>
          <h2 className="text-lg font-semibold text-text-primary mb-2">数据与安全 Data & Security</h2>
          <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
            配置占位 — 点击管理
          </div>
        </section>
      </div>

      <ProviderSheet
        isOpen={activeSheet === 'provider'}
        providerId={selectedProviderId}
        onClose={() => setActiveSheet(null)}
        onSaved={handleProviderSaved}
      />

      <ModelSheet
        isOpen={activeSheet === 'model'}
        onClose={() => setActiveSheet(null)}
        onSaved={handleModelSaved}
      />

      <PromptSheet
        isOpen={activeSheet === 'prompt'}
        onClose={() => setActiveSheet(null)}
        onSaved={handlePromptSaved}
      />

      <DataCleanupSheet
        isOpen={activeSheet === 'cleanup'}
        onClose={() => setActiveSheet(null)}
      />
    </div>
  )
}