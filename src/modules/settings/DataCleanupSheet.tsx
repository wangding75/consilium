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

const DEFAULT_IMPORT_OVERWRITE = false

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
  const [importOverwrite, setImportOverwrite] = useState(DEFAULT_IMPORT_OVERWRITE)

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

      if (sessionsBody.success) {
        setSessionCount(sessionsBody.data?.sessions?.length ?? 0)
      }
      if (providersBody.success) {
        setProviderCount(Array.isArray(providersBody.data?.connections) ? providersBody.data.connections.length : 0)
      }
      if (promptsBody.success) {
        setPromptCount(Array.isArray(promptsBody.data) ? promptsBody.data.length : 0)
      }
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
    setImportOverwrite(DEFAULT_IMPORT_OVERWRITE)
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
    if (clearAllStep === 1) {
      setClearAllStep(2)
    } else if (clearAllStep === 2) {
      setClearAllStep(3)
      setShowConfirm(true)
    }
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
    if (!file) {
      return
    }

    setSelectedFileName(file.name)
    setFeedback('')
    setImportPreview(null)
    setImportBundle(null)

    try {
      const text = await file.text()
      const bundle = JSON.parse(text) as SettingsExportBundle
      const request: SettingsImportPreviewRequest = {
        bundle,
        fileName: file.name,
      }
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
    if (!importPreview || !importBundle) {
      return
    }

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
      if (body.success) {
        setFeedback('导入成功')
      } else {
        setFeedback('导入失败')
      }
    } catch {
      setFeedback('导入失败')
    } finally {
      setImporting(false)
    }
  }

  const sessionCountDisplay = sessionCount !== null ? `${sessionCount} 个会话` : ''
  const promptCountDisplay = promptCount !== null ? `${promptCount} 个提示词` : ''
  const providerCountDisplay = providerCount !== null ? `${providerCount} 个 Provider` : ''

  return (
    <div role="dialog" className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2>数据安全设置</h2>
        <button onClick={onClose} aria-label="关闭">✕</button>
      </div>

      {loading ? (
        <p>加载中...</p>
      ) : countsFailed ? (
        <p>暂无法统计</p>
      ) : (
        <p>{[sessionCountDisplay, promptCountDisplay, providerCountDisplay].filter(Boolean).join(' · ')}</p>
      )}

      <section className="space-y-2">
        <h3>导出</h3>
        <p className="text-sm text-text-secondary">导出当前设置快照，便于备份和迁移。</p>
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? '导出中...' : '导出设置'}
        </button>
      </section>

      <section className="space-y-2">
        <h3>导入</h3>
        <label>
          导入文件
          <input aria-label="导入文件" type="file" accept="application/json" onChange={handleImportFileChange} />
        </label>
        {selectedFileName ? <p>已选择：{selectedFileName}</p> : null}
        {importPreview ? (
          <div className="rounded-lg border border-border p-3 text-sm">
            <p>预检查 Token：{importPreview.previewToken}</p>
            <p>新增：{importPreview.additions.length}</p>
            <p>更新：{importPreview.updates.length}</p>
            <p>冲突：{importPreview.conflicts.length}</p>
            <p>无效项：{importPreview.invalidItems.length}</p>
            {importPreview.conflicts.length > 0 ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={importOverwrite}
                  onChange={(event) => setImportOverwrite(event.target.checked)}
                />
                允许覆盖冲突项
              </label>
            ) : null}
            <button
              type="button"
              onClick={handleImportCommit}
              disabled={importing || (importPreview.conflicts.length > 0 && !importOverwrite)}
            >
              {importing ? '导入中...' : '确认导入'}
            </button>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3>清理数据</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleClearClick('cache')}>clean cache</button>
          <button onClick={() => handleClearClick('sessions')}>clean session</button>
          <button onClick={() => handleClearClick('settings')}>clean settings</button>
          <button onClick={() => handleClearClick('all')}>clean all</button>
        </div>
      </section>

      <section className="rounded-lg border border-border border-dashed p-3 text-sm text-text-secondary">
        <h3 className="mb-2 text-text-primary">数据处理说明</h3>
        <p>敏感信息不会在页面中明文展示；导入导出和清理操作都应在确认后执行。</p>
      </section>

      {feedback ? <p>{feedback}</p> : null}

      {clearAllStep >= 1 && clearScope === 'all' && (
        <ConfirmDialog
          isOpen={clearAllStep === 1}
          title="清理全部"
          message="步骤 1 - 影响范围：清理全部数据将导致 Provider 不可用，需要重新配置"
          confirmText="下一步"
          onConfirm={handleClearAllNext}
          onCancel={handleCancel}
        />
      )}

      {clearAllStep === 2 && clearScope === 'all' && (
        <ConfirmDialog
          isOpen={true}
          title="清理全部"
          message="确认删除"
          confirmText="下一步"
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
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {clearScope === 'cache' && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="缓存清理"
          message="确定要清理缓存吗？"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {clearScope === 'sessions' && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="会话清理"
          message="确定要清理所有会话数据吗？"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {clearScope === 'settings' && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="设置清理"
          message="Provider 将不可用，需要重新配置"
          variant="danger"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

export default DataCleanupSheet
