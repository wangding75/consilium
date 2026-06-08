'use client'

import React, { useState } from 'react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  requireTyping?: string
  variant?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ isOpen, title, message, confirmText, requireTyping, variant, onConfirm, onCancel }: ConfirmDialogProps): React.ReactElement | null {
  const [typedValue, setTypedValue] = useState('')

  if (!isOpen) return null

  const isConfirmDisabled = requireTyping ? typedValue !== requireTyping : false

  const variantClass = variant === 'danger' ? 'bg-red-600 text-white' : ''

  return (
    <div role="dialog" aria-label={title}>
      <h3>{title}</h3>
      <p>{message}</p>
      {requireTyping && (
        <input
          type="text"
          placeholder={requireTyping}
          value={typedValue}
          onChange={(e) => setTypedValue(e.target.value)}
        />
      )}
      <button onClick={onCancel}>取消</button>
      <button
        className={variantClass}
        onClick={onConfirm}
        disabled={isConfirmDisabled}
      >
        {confirmText ?? '确认'}
      </button>
    </div>
  )
}

export default ConfirmDialog