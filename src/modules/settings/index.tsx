'use client'

import { useState, type ReactNode } from 'react'
import type { ProviderType } from '@/types'
import { DataCleanupSheet } from '@/modules/settings/DataCleanupSheet'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'
import { TemplatesModule } from '@/modules/templates'

type ActiveView = 'home' | 'provider' | 'template' | 'data-security'

const PROVIDER_TYPES: ProviderType[] = ['openai', 'anthropic', 'gemini', 'deepseek', 'custom']

interface EntryCardProps {
  title: string
  description: string
  onClick: () => void
}

interface SecondaryViewProps {
  title: string
  onBack: () => void
  children: ReactNode
}

function EntryCard({ title, description, onClick }: EntryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-surface p-4 text-left transition hover:bg-background"
    >
      <div className="text-base font-semibold text-text-primary">{title}</div>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </button>
  )
}

function SecondaryView({ title, onBack, children }: SecondaryViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary"
        >
          返回
        </button>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export function SettingsModule() {
  const [activeView, setActiveView] = useState<ActiveView>('home')
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderType>('openai')

  return (
    <div className="p-4">
      <h1 className="mb-2 text-xl font-bold text-text-primary">设置</h1>
      <p className="mb-6 text-sm text-text-secondary">管理连接、模板与数据策略</p>

      {activeView === 'home' ? (
        <div className="grid gap-4">
          <EntryCard
            title="厂商配置"
            description="管理 Provider 连接、模型列表与连通性测试。"
            onClick={() => setActiveView('provider')}
          />
          <EntryCard
            title="模板配置"
            description="查看模板与角色配置，并进入模板管理视图。"
            onClick={() => setActiveView('template')}
          />
          <EntryCard
            title="数据安全"
            description="导入导出配置、清理本地数据并查看隐私说明。"
            onClick={() => setActiveView('data-security')}
          />
        </div>
      ) : null}

      {activeView === 'provider' ? (
        <SecondaryView title="厂商配置" onBack={() => setActiveView('home')}>
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-3">
              <p className="mb-3 text-sm text-text-secondary">选择要管理的 Provider 类型。</p>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_TYPES.map((providerType) => (
                  <button
                    key={providerType}
                    type="button"
                    onClick={() => setSelectedProviderId(providerType)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${selectedProviderId === providerType ? 'border-accent text-accent' : 'border-border text-text-primary'}`}
                    aria-pressed={selectedProviderId === providerType}
                  >
                    {providerType}
                  </button>
                ))}
              </div>
            </div>
            <ProviderSheet
              isOpen={true}
              providerId={selectedProviderId}
              onClose={() => setActiveView('home')}
              onSaved={() => undefined}
            />
          </div>
        </SecondaryView>
      ) : null}

      {activeView === 'template' ? (
        <SecondaryView title="模板配置" onBack={() => setActiveView('home')}>
          <div className="rounded-xl border border-border bg-surface">
            <TemplatesModule />
          </div>
        </SecondaryView>
      ) : null}

      {activeView === 'data-security' ? (
        <SecondaryView title="数据安全" onBack={() => setActiveView('home')}>
          <DataCleanupSheet isOpen={true} onClose={() => setActiveView('home')} />
        </SecondaryView>
      ) : null}
    </div>
  )
}
