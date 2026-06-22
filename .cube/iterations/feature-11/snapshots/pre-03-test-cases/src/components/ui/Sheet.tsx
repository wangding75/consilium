'use client'

import React, { useEffect } from 'react'
import { Button } from './Button'

export interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export function Sheet({ isOpen, onClose, title, children }: SheetProps) {
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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-surface rounded-t-2xl p-4 pb-8">
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

export default Sheet
