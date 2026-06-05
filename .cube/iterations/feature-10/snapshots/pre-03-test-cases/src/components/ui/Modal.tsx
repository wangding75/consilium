'use client'

import React, { useEffect } from 'react'
import { Button } from './Button'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-surface rounded-2xl p-6 shadow-xl">
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export default Modal
