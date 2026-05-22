'use client'

import { useState } from 'react'

interface MoreSheetProps {
  isOpen: boolean
  onClose: () => void
  onSelectCommand?: (content: string) => void
  canIntervene?: boolean
  onArchive?: () => void
  onResume?: () => void
  onComplete?: () => void
}

export function MoreSheet({ isOpen, onClose, onSelectCommand, canIntervene = true, onArchive, onResume: _onResume, onComplete: _onComplete }: MoreSheetProps) {
  const [modalMessage, setModalMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const commandEntries = [
    { label: '让诸葛亮反驳一下', icon: '💬' },
    { label: '总结当前结论', icon: '📋' },
    { label: '触发投票', icon: '🗳️' },
  ]

  const handleClick = (label: string) => {
    onSelectCommand?.(label)
    setModalMessage('后续迭代将支持此指令的完整功能')
    onClose()
  }

  const handleArchive = () => {
    onArchive?.()
    setModalMessage('后续迭代将支持归档功能')
  }

  return (
    <div>
      {commandEntries.map((entry) => (
        <button
          key={entry.label}
          type="button"
          disabled={!canIntervene}
          onClick={() => handleClick(entry.label)}
          style={{ cursor: canIntervene ? 'pointer' : 'not-allowed', padding: '8px 0', display: 'block', width: '100%', textAlign: 'left', opacity: canIntervene ? 1 : 0.5 }}
          aria-label={entry.label}
        >
          {entry.icon} {entry.label}
        </button>
      ))}
      <button
        type="button"
        onClick={handleArchive}
        style={{ cursor: 'pointer', padding: '8px 0', display: 'block', width: '100%', textAlign: 'left' }}
      >
        📦 归档会话
      </button>
      {modalMessage && (
        <div role="dialog">
          <p>{modalMessage}</p>
          <button type="button" onClick={() => setModalMessage(null)}>关闭</button>
        </div>
      )}
    </div>
  )
}
