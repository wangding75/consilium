'use client'

interface SummaryActionsProps {
  onGoHome: () => void
  onViewSessions: () => void
  onResume: () => void
  disabled?: boolean
}

export function SummaryActions({ onGoHome, onViewSessions, onResume, disabled = false }: SummaryActionsProps) {
  return (
    <div className="flex gap-2" aria-label="总结后操作">
      <button type="button" onClick={onGoHome} disabled={disabled}>返回首页</button>
      <button type="button" onClick={onViewSessions} disabled={disabled}>查看会话</button>
      <button type="button" onClick={onResume} disabled={disabled}>继续追问</button>
    </div>
  )
}
