'use client'

import { useState, type ReactNode } from 'react'
import type { ProviderType } from '@/types'
import { DataCleanupSheet } from '@/modules/settings/DataCleanupSheet'
import { ProviderSheet } from '@/modules/settings/ProviderSheet'
import { TemplatesModule } from '@/modules/templates'

type ActiveView = 'home' | 'provider' | 'template' | 'data-security'

const PROVIDER_LABELS: Record<string, { label: string; icon: string }> = {
  openai: { label: 'OpenAI', icon: '◎' },
  anthropic: { label: 'Anthropic', icon: 'AI' },
  gemini: { label: 'Gemini', icon: '✦' },
  deepseek: { label: 'DeepSeek', icon: '◒' },
  custom: { label: 'Custom', icon: '⊿' },
}

interface BigCardProps {
  icon: string
  title: string
  description: string
  onClick: () => void
}

interface SecondaryViewProps {
  title: string
  subtitle: string
  onBack: () => void
  children: ReactNode
}

function BigCard({ icon, title, description, onClick }: BigCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[14px] rounded-[20px] border border-[#e5eaf2] bg-white p-4 text-left shadow-[0_10px_26px_rgba(15,23,42,.04)] transition active:scale-[0.985]"
    >
      <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-[16px] bg-[#eaf2ff] text-[25px] text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <div className="text-[17px] font-extrabold text-text-primary">{title}</div>
        <p className="mt-[5px] text-xs leading-relaxed text-[#6b7280]">{description}</p>
      </span>
      <span className="ml-auto flex-shrink-0 text-2xl font-extrabold text-[#94a3b8]">›</span>
    </button>
  )
}

function SecondaryView({ title, subtitle, onBack, children }: SecondaryViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 min-h-[48px]">
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 w-9 h-9 rounded-full border border-transparent bg-white grid place-items-center text-[26px] text-text-primary active:scale-[0.98]"
        >
          ‹
        </button>
        <div>
          <h2 className="text-[22px] font-extrabold tracking-[-0.3px] text-text-primary">{title}</h2>
          <p className="text-xs text-[#6b7280]">{subtitle}</p>
        </div>
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
      {activeView === 'home' ? (
        <>
          <div className="mb-[18px]">
            <h1 className="text-[22px] font-extrabold tracking-[-0.3px] text-text-primary">设置</h1>
            <p className="mt-[5px] text-xs text-[#6b7280]">只保留高频配置入口，复杂配置进入二级页完成</p>
          </div>

          <div className="grid gap-[14px]">
            <BigCard
              icon="⚡"
              title="厂商配置"
              description="管理 OpenAI、Anthropic、Gemini、DeepSeek、Custom 等连接，可为同一厂商配置多个链接"
              onClick={() => setActiveView('provider')}
            />
            <BigCard
              icon="▣"
              title="模板配置"
              description="模板、角色、模型、提示词统一在这里配置；模型和 Prompt 不再作为设置页独立入口"
              onClick={() => setActiveView('template')}
            />
            <BigCard
              icon="♧"
              title="数据安全"
              description="会话导出、设置导入导出、本地数据清理、API Key 保存策略与隐私说明"
              onClick={() => setActiveView('data-security')}
            />
          </div>

          <div className="mt-[18px] rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fbff] p-3 text-xs leading-relaxed text-[#334155]">
            <b className="text-[#1e40af]">补充交互：</b>本版原型已补齐卡片点击后的编辑流程：点击 <b>OpenAI · 官方接口</b> 可进入编辑页；点击模板中的角色卡片可进入角色编辑页；{'点击右上角 "＋" 可进入新增厂商、新增角色页面。'}
          </div>
        </>
      ) : null}

      {activeView === 'provider' ? (
        <SecondaryView
          title="厂商配置"
          subtitle={'先展示连接列表；点卡片进入编辑，点右上角 “＋” 新增连接'}
          onBack={() => setActiveView('home')}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-[#e5eaf2] bg-white p-3">
              <p className="mb-3 text-sm text-[#6b7280]">选择要管理的 Provider 类型。</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PROVIDER_LABELS) as ProviderType[]).map((providerType) => (
                  <button
                    key={providerType}
                    type="button"
                    onClick={() => setSelectedProviderId(providerType)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98] ${selectedProviderId === providerType ? 'border-primary text-primary bg-[#eaf2ff]' : 'border-[#e5eaf2] text-text-primary bg-white'}`}
                    aria-pressed={selectedProviderId === providerType}
                  >
                    {PROVIDER_LABELS[providerType].label}
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
        <SecondaryView
          title="模板配置"
          subtitle="点模板卡片进入详情；角色、模型、Prompt 在模板内部维护"
          onBack={() => setActiveView('home')}
        >
          <div className="rounded-xl border border-[#e5eaf2] bg-white">
            <TemplatesModule />
          </div>
        </SecondaryView>
      ) : null}

      {activeView === 'data-security' ? (
        <SecondaryView
          title="数据安全"
          subtitle="本地数据、导入导出、隐私与清理"
          onBack={() => setActiveView('home')}
        >
          <DataCleanupSheet isOpen={true} onClose={() => setActiveView('home')} />
        </SecondaryView>
      ) : null}
    </div>
  )
}