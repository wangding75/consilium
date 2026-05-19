'use client'

interface DiscussionHeaderProps {
  topic: string
  templateName: string
  onBack: () => void
  onMore: () => void
}

export function DiscussionHeader({
  topic: _topic,
  templateName: _templateName,
  onBack: _onBack,
  onMore: _onMore,
}: DiscussionHeaderProps) {
  return <header />
}
