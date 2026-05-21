'use client'

import React, { useEffect } from 'react'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning'

export interface ToastProps {
  message: string
  variant?: ToastVariant
  isVisible: boolean
  onDismiss?: () => void
  duration?: number
}

export function Toast({ message, variant = 'default', isVisible, onDismiss, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && onDismiss) {
      const timer = setTimeout(onDismiss, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, onDismiss, duration])

  if (!isVisible) return null

  const variants = {
    default: 'bg-gray-800 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-white',
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[360px] w-[calc(100%-2rem)]">
      <div className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${variants[variant]}`}>
        {message}
      </div>
    </div>
  )
}

export default Toast
