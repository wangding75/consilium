'use client'

import { useEffect, useState } from 'react'
import type { ProviderStatusDTO, ModelDefaultsDTO } from '@/types/api'

export function SettingsModule() {
  const [providers, setProviders] = useState<ProviderStatusDTO[]>([])
  const [modelDefaults, setModelDefaults] = useState<ModelDefaultsDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
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
    load()
  }, [])

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
          ) : providers.length === 0 ? (
            <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
              未配置 Provider · 暂无可用模型供应商
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => (
                <div key={p.providerId} className="rounded-xl border border-border p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-text-primary">{p.providerId}</div>
                    <div className="text-xs text-text-muted">
                      {p.maskedKey ? `Key: ${p.maskedKey}` : '未配置 Key'} · {p.modelList.length} 个
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
                      <span className="text-xs text-text-muted">已禁用</span>
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
          <div className="rounded-xl border border-border p-3">
            {modelDefaults ? (
              <div className="text-sm text-text-primary">
                <div>{modelDefaults.model}</div>
                <div>温度: {modelDefaults.temperature} · 最大 Tokens: {modelDefaults.maxTokens}</div>
              </div>
            ) : (
              <div className="text-text-muted text-sm">未设置全局默认模型</div>
            )}
          </div>
        </section>

        {/* Template section (placeholder) */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">模板管理 Template</h2>
          <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
            配置占位 — 后续迭代实现
          </div>
        </section>

        {/* Prompt section */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Prompt 提示词配置</h2>
          <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
            配置占位 — 后续迭代实现
          </div>
        </section>

        {/* Data / Security section */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-2">数据与安全 Data & Security</h2>
          <div className="rounded-xl border border-border border-dashed p-4 text-center text-text-muted text-sm">
            配置占位 — 后续迭代实现
          </div>
        </section>
      </div>
    </div>
  )
}