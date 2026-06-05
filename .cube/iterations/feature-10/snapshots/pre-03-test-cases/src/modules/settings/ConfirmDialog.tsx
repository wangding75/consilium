'use client'

import React from 'react'

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

export function ConfirmDialog(_props: ConfirmDialogProps): React.ReactElement | null {
  throw new Error('not implemented')
}

export default ConfirmDialog