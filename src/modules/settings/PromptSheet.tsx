'use client'

import React, { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/modules/settings/ConfirmDialog'

export interface PromptSheetProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

interface PromptItem {
  promptId: string
  scope: string
  version: string
  content: string
  updatedAt: string
  isDefault: boolean
  targetId?: string
}

export function PromptSheet({ isOpen, onClose, onSaved }: PromptSheetProps): React.ReactElement | null {
  const [prompts, setPrompts] = useState<PromptItem[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPrompts = async () => {
    try {
      const res = await fetch('/api/settings/prompts')
      const body = await res.json()
      if (body.success && Array.isArray(body.data)) {
        setPrompts(body.data)
      }
    } catch {
      // keep existing
    }
  }

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    loadPrompts().finally(() => setLoading(false))
  }, [isOpen])

  if (!isOpen) return null

  const selectedPrompt = prompts.find((p) => p.promptId === selectedPromptId)
  const globalPrompts = prompts.filter((p) => p.scope === 'global')
  const rolePrompts = prompts.filter((p) => p.scope === 'role')

  const handlePromptClick = (prompt: PromptItem) => {
    setSelectedPromptId(prompt.promptId)
    setEditContent(prompt.content)
  }

  const handleSaveClick = () => {
    setShowSaveConfirm(true)
  }

  const handleSaveConfirm = async () => {
    setShowSaveConfirm(false)
    if (!selectedPromptId) return
    try {
      await fetch('/api/settings/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: selectedPromptId, content: editContent }),
      })
      await loadPrompts()
      onSaved()
    } catch {
      // keep state
    }
  }

  const handleSaveCancel = () => {
    setShowSaveConfirm(false)
  }

  const handleRestoreClick = () => {
    setShowRestoreConfirm(true)
  }

  const handleRestoreConfirm = async () => {
    setShowRestoreConfirm(false)
    if (!selectedPromptId) return
    try {
      await fetch('/api/settings/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptId: selectedPromptId, reset: true }),
      })
      await loadPrompts()
      onSaved()
    } catch {
      // keep state
    }
  }

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false)
  }

  return (
    <div role="dialog">
      <h2>Prompt 提示词配置</h2>
      <button onClick={onClose} aria-label="关闭">✕</button>

      {loading ? (
        <p>加载中...</p>
      ) : prompts.length === 0 ? (
        <p>暂无 Prompt 配置</p>
      ) : (
        <>
          <div>
            <h3>全局 Prompt</h3>
            {globalPrompts.map((p) => (
              <div key={p.promptId}>
                <button onClick={() => handlePromptClick(p)}>{p.promptId}</button>
                <span>{p.version}</span>
                <span>{p.updatedAt}</span>
              </div>
            ))}
          </div>
          <div>
            <h3>角色 Prompt</h3>
            {rolePrompts.map((p) => (
              <div key={p.promptId}>
                <button onClick={() => handlePromptClick(p)}>{p.promptId}</button>
                <span>{p.version}</span>
                <span>{p.updatedAt}</span>
              </div>
            ))}
          </div>

          {selectedPromptId && selectedPrompt && (
            <div>
              <h4>{selectedPrompt.promptId}</h4>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <button onClick={handleSaveClick}>保存</button>
              {!selectedPrompt.isDefault && (
                <button onClick={handleRestoreClick}>恢复默认</button>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={showSaveConfirm}
        title="保存提示"
        message="确定要保存 Prompt 修改吗？"
        onConfirm={handleSaveConfirm}
        onCancel={handleSaveCancel}
      />

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="恢复提示"
        message="确定要恢复默认 Prompt 吗？"
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
      />
    </div>
  )
}

export default PromptSheet