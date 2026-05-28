'use client'

interface DiscussionHeaderProps {
  topic: string
  templateName: string
  onBack: () => void
  onMore: () => void
}

export function DiscussionHeader({
  topic,
  templateName,
  onBack,
  onMore,
}: DiscussionHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border">
      <button aria-label="返回" onClick={onBack}>←</button>
      <div className="flex flex-col items-center">
        <span className="font-medium">{topic}</span>
        <span className="text-xs text-text-secondary">{templateName}</span>
      </div>
      <button aria-label="更多" onClick={onMore}>⋯</button>
    </header>
  )
}
