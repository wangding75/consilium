'use client'

import React, { useEffect, useState } from 'react'
import type { SettingsExportBundle } from '@/types'
import type { SettingsImportPreviewRequest } from '@/types/api'
import { ConfirmDialog } from '@/modules/settings/ConfirmDialog'

export interface DataCleanupSheetProps {
  isOpen: boolean
  onClose: () => void
}

type ClearScope = 'cache' | 'sessions' | 'settings' | 'all' | null

interface ImportPreviewState {
  previewToken: string
  additions: string[]
  updates: string[]
  conflicts: string[]
  invalidItems: string[]
}

const listCard = 'w-full border border-[#e5eaf2] bg-white rounded-[20px] p-[13px] text-left shadow-[0_10px_26px_rgba(15,23,42,.04)]'
const cardName = 'text-[15px] font-extrabold text-text-primary'
const cardMeta = 'text-[11px] text-text-muted leading-relaxed mt-[5px]'
const noteStyle = 'mt-[18px] border border-dashed border-[#cbd5e1] bg-[#f8fbff] rounded-2xl p-3 text-xs leading-relaxed text-[#334155]'
const btnBase = 'min-h-[34px] rounded-[13px] px-[14px] text-xs font-extrabold'
const btnPrimary = `${btnBase} bg-primary text-white disabled:opacity-50`
const btnGhost = `${btnBase} border border-[#e5eaf2] bg-white text-[#334155]`
const btnDanger = `${btnBase} bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]`

export function DataCleanupSheet({ isOpen, onClose }: DataCleanupSheetProps): React.ReactElement | null {
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [providerCount, setProviderCount] = useState<number | null>(null)
  const [promptCount, setPromptCount] = useState<number | null>(null)
  const [countsFailed, setCountsFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [clearScope, setClearScope] = useState<ClearScope>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [clearAllStep, setClearAllStep] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null)
  const [importBundle, setImportBundle] = useState<SettingsExportBundle | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importOverwrite, setImportOverwrite] = useState(false)

  const loadCounts = async () => {
    try {
      const [sessionsRes, providersRes, promptsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/settings/provider-connections'),
        fetch('/api/settings/prompts'),
      ])
      const sessionsBody = await sessionsRes.json()
      const providersBody = await providersRes.json()
      const promptsBody = await promptsRes.json()

      if (sessionsBody.success) setSessionCount(sessionsBody.data?.sessions?.length ?? 0)
      if (providersBody.success) setProviderCount(Array.isArray(providersBody.data?.connections) ? providersBody.data.connections.length : 0)
      if (promptsBody.success) setPromptCount(Array.isArray(promptsBody.data) ? promptsBody.data.length : 0)
    } catch {
      setCountsFailed(true)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setCountsFailed(false)
    setClearAllStep(0)
    setFeedback('')
    setImportPreview(null)
    setImportBundle(null)
    setImportOverwrite(false)
    void loadCounts().finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const handleClearClick = (scope: ClearScope) => {
    setClearScope(scope)
    setFeedback('')
    if (scope === 'all') {
      setClearAllStep(1)
    } else {
      setShowConfirm(true)
    }
  }

  const handleClearAllNext = () => {
    if (clearAllStep === 1) { setClearAllStep(2) }
    else if (clearAllStep === 2) { setClearAllStep(3); setShowConfirm(true) }
  }

  const handleConfirm = async () => {
    setShowConfirm(false)
    if (!clearScope) return
    try {
      const res = await fetch('/api/settings/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: clearScope }),
      })
      const body = await res.json()
      if (body.success) {
        setFeedback('清理成功')
        if (clearScope === 'all') {
          onClose()
        } else {
          void loadCounts()
        }
      } else {
        setFeedback('清理失败')
      }
    } catch {
      setFeedback('清理失败')
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
    setClearScope(null)
    setClearAllStep(0)
  }

  const handleExport = async () => {
    setExporting(true)
    setFeedback('')
    try {
      const res = await fetch('/api/settings/export')
      const body = await res.json()
      if (body.success) {
        const blob = new Blob([JSON.stringify(body.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `settings-export-${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        URL.revokeObjectURL(url)
        setFeedback('导出成功')
      } else {
        setFeedback('导出失败')
      }
    } catch {
      setFeedback('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setSelectedFileName(file.name)
    setFeedback('')
    setImportPreview(null)
    setImportBundle(null)
    try {
      const text = await file.text()
      const bundle = JSON.parse(text) as SettingsExportBundle
      const request: SettingsImportPreviewRequest = { bundle, fileName: file.name }
      const res = await fetch('/api/settings/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const body = await res.json()
      if (body.success) {
        setImportBundle(bundle)
        setImportPreview(body.data)
      } else {
        setFeedback('导入预检查失败')
      }
    } catch {
      setFeedback('导入预检查失败')
    }
  }

  const handleImportCommit = async () => {
    if (!importPreview || !importBundle) return
    setImporting(true)
    setFeedback('')
    try {
      const res = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle: importBundle,
          previewToken: importPreview.previewToken,
          overwrite: importOverwrite,
        }),
      })
      const body = await res.json()
      if (body.success) setFeedback('导入成功')
      else setFeedback('导入失败')
    } catch {
      setFeedback('导入失败')
    } finally {
      setImporting(false)
    }
  }

  const totalsDisplay = [sessionCount !== null ? `${sessionCount} 个会话` : '', promptCount !== null ? `${promptCount} 个提示词` : '', providerCount !== null ? `${providerCount} 个 Provider` : ''].filter(Boolean).join(' · ')

  return (
    <div>
      {loading ? (
        <p className="text-sm text-text-muted mb-4">统计中...</p>
      ) : countsFailed ? (
        <p className="text-sm text-text-muted mb-4">暂无法统计</p>
      ) : (
        <p className="text-[11px] text-text-muted mb-4">{totalsDisplay}</p>
      )}

      <div className="grid gap-[10px]">
        <div className={listCard}>
          <div className={cardName}>导出设置 JSON</div>
          <div className={cardMeta}>导出厂商连接脱敏信息、模板配置、数据偏好，不包含 API Key 明文</div>
          <div className="mt-[10px]">
            <button type="button" onClick={handleExport} disabled={exporting} className={btnPrimary}>
              {exporting ? '导出中...' : '导出'}
            </button>
          </div>
        </div>

        <div className={listCard}>
          <div className={cardName}>导入设置 JSON</div>
          <div className={cardMeta}>从本地文件恢复设置，导入前展示覆盖确认</div>
          <div className="mt-[10px]">
            <label className={`${btnGhost} inline-flex items-center cursor-pointer active:scale-[0.98]`}>
              {selectedFileName ? `已选择：${selectedFileName}` : '选择文件'}
              <input type="file" accept="application/json" onChange={handleImportFileChange} className="hidden" />
            </label>
            {importPreview && (
              <div className="mt-3 rounded-[13px] border border-[#e5eaf2] bg-[#f8fafc] p-3 text-[11px] leading-relaxed">
                <p className="text-xs font-extrabold mb-2">预检查结果</p>
                <p className="text-text-muted">新增：{importPreview.additions.length} · 更新：{importPreview.updates.length} · 冲突：{importPreview.conflicts.length} · 无效：{importPreview.invalidItems.length}</p>
                {importPreview.conflicts.length > 0 ? (
                  <label className="flex items-center gap-2 mt-2 text-xs">
                    <input type="checkbox" checked={importOverwrite} onChange={(e) => setImportOverwrite(e.target.checked)} />
                    允许覆盖冲突项
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={handleImportCommit}
                  disabled={importing || (importPreview.conflicts.length > 0 && !importOverwrite)}
                  className={`${btnPrimary} mt-2`}
                >
                  {importing ? '导入中...' : '确认导入'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={listCard}>
          <div className={cardName}>导出全部会话 Markdown</div>
          <div className={cardMeta}>会话导出不包含 API Key，不改变单会话导出能力</div>
        </div>

        <div className={listCard}>
          <div className="flex items-center justify-between gap-[10px]">
            <div>
              <div className={cardName}>清理本地数据</div>
              <div className={cardMeta}>清理前必须二次确认，可选择只清缓存或清空会话 / 设置</div>
            </div>
            <button type="button" onClick={() => handleClearClick('all')} className={btnDanger}>
              清理
            </button>
          </div>
        </div>
      </div>

      <div className={noteStyle}>
        <b className="text-[#1e40af]">说明：</b>数据安全页本次不新增可编辑实体，因此不提供 "＋" 新建入口；重点是导入导出和清理确认流程。
      </div>

      {feedback && <p className="mt-3 text-xs text-green">{feedback}</p>}

      {/* confirm dialogs */}
      {clearAllStep >= 1 && clearScope === 'all' && clearAllStep === 1 && (
        <ConfirmDialog
          isOpen
          title="清理全部"
          message="步骤 1 - 影响范围：清理全部数据将导致 Provider 不可用，需要重新配置"
          confirmText="下一步"
          variant="danger"
          onConfirm={handleClearAllNext}
          onCancel={handleCancel}
        />
      )}
      {clearAllStep === 2 && clearScope === 'all' && (
        <ConfirmDialog
          isOpen
          title="清理全部"
          message="步骤 2 - 确认删除"
          confirmText="下一步"
          variant="danger"
          requireTyping="确认删除"
          onConfirm={handleClearAllNext}
          onCancel={handleCancel}
        />
      )}
      {clearAllStep === 3 && clearScope === 'all' && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="清理全部"
          message="最后一步，确定要清理全部数据吗？"
          variant="danger"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      {clearScope === 'cache' && (
        <ConfirmDialog isOpen={showConfirm} title="缓存清理" message="确定要清理缓存吗？" onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
      {clearScope === 'sessions' && (
        <ConfirmDialog isOpen={showConfirm} title="会话清理" message="确定要清理所有会话数据吗？" onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
      {clearScope === 'settings' && (
        <ConfirmDialog isOpen={showConfirm} title="设置清理" message="Provider 将不可用，需要重新配置" variant="danger" onConfirm={handleConfirm} onCancel={handleCancel} />
      )}
    </div>
  )
}

export default DataCleanupSheet