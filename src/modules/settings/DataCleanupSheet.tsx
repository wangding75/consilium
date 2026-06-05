'use client'

import React, { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/modules/settings/ConfirmDialog'

export interface DataCleanupSheetProps {
  isOpen: boolean
  onClose: () => void
}

type ClearScope = 'sessions' | 'settings' | 'all' | null

export function DataCleanupSheet({ isOpen, onClose }: DataCleanupSheetProps): React.ReactElement | null {
  const [sessionCount, setSessionCount] = useState<number | null>(null)
  const [providerCount, setProviderCount] = useState<number | null>(null)
  const [promptCount, setPromptCount] = useState<number | null>(null)
  const [countsFailed, setCountsFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  const [clearScope, setClearScope] = useState<ClearScope>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // clear-all flow state
  const [clearAllStep, setClearAllStep] = useState(0)
  const [typedWord, setTypedWord] = useState('')

  const [error, setError] = useState('')

  const loadCounts = async () => {
    try {
      const [sessionsRes, providersRes, promptsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/llm/providers'),
        fetch('/api/settings/prompts'),
      ])
      const sessionsBody = await sessionsRes.json()
      const providersBody = await providersRes.json()
      const promptsBody = await promptsRes.json()

      if (sessionsBody.success) {
        setSessionCount(sessionsBody.data?.sessions?.length ?? 0)
      }
      if (providersBody.success) {
        setProviderCount(Array.isArray(providersBody.data) ? providersBody.data.length : 0)
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
    setTypedWord('')
    setError('')
    loadCounts().finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const handleClearClick = (scope: ClearScope) => {
    setClearScope(scope)
    setError('')
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
        if (clearScope === 'all') {
          onClose()
        } else {
          // reload counts after partial cleanup
          loadCounts()
        }
      } else {
        setError('清理失败')
      }
    } catch {
      setError('清理失败')
    }
  }

  const handleCancel = () => {
    setShowConfirm(false)
    setClearScope(null)
    setClearAllStep(0)
    setTypedWord('')
  }

  const sessionCountDisplay = sessionCount !== null ? `${sessionCount} 个会话` : ''
  const promptCountDisplay = promptCount !== null ? `${promptCount} 个提示词` : ''
  const providerCountDisplay = providerCount !== null ? `${providerCount} 个 Provider` : ''

  return (
    <div role="dialog">
      <h2>数据安全设置</h2>
      <button onClick={onClose} aria-label="关闭">✕</button>

      {loading ? (
        <p>加载中...</p>
      ) : countsFailed ? (
        <p>暂无法统计</p>
      ) : (
        <p>{[sessionCountDisplay, promptCountDisplay, providerCountDisplay].filter(Boolean).join(' · ')}</p>
      )}

      <button onClick={() => handleClearClick('sessions')}>clean session</button>
      <button onClick={() => handleClearClick('settings')}>clean settings</button>
      <button onClick={() => handleClearClick('all')}>clean all</button>

      {error && <p>{error}</p>}

      {/* Clear all step 1: impact scope */}
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

      {/* Clear all step 2: type confirmation word */}
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

      {/* Clear all step 3: final confirm */}
      {clearAllStep === 3 && clearScope === 'all' && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="清理全部"
          message="最后一步，确定要清理全部数据吗？"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Sessions confirm */}
      {clearScope === 'sessions' && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="会话清理"
          message="确定要清理所有会话数据吗？"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Settings confirm */}
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