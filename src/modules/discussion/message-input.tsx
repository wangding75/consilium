'use client'

interface MessageInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
}

export function MessageInput({ onSend: _onSend, disabled: _disabled = false }: MessageInputProps) {
  return (
    <div className="flex gap-2 p-4 border-t border-border">
      <input className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" disabled />
      <button className="rounded-lg bg-primary px-4 py-2 text-sm text-white" disabled>
        发送
      </button>
    </div>
  )
}
