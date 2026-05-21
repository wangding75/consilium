'use client'

interface TypingIndicatorProps {
  speakerName: string | null
}

export function TypingIndicator({ speakerName }: TypingIndicatorProps) {
  if (speakerName) {
    return <span>{speakerName}正在输入...</span>
  }
  return <span>正在生成...</span>
}
