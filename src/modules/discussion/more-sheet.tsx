'use client'

interface MoreSheetProps {
  isOpen: boolean
  onClose: () => void
  onSelectCommand?: (content: string) => void
  onArchive?: () => void
  onResume?: () => void
  onComplete?: () => void
}

export function MoreSheet({ isOpen, onClose, onSelectCommand, onArchive: _onArchive, onResume: _onResume, onComplete: _onComplete }: MoreSheetProps) {
  if (!isOpen) return null

  const entries = [
    '让诸葛亮反驳一下',
    '总结当前结论',
    '触发投票',
  ]

  return (
    <div>
      {entries.map((entry) => (
        <div
          key={entry}
          onClick={() => {
            onSelectCommand?.(entry)
            onClose()
          }}
          style={{ cursor: 'pointer', padding: '8px 0' }}
        >
          {entry}
        </div>
      ))}
    </div>
  )
}
