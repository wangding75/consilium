import React from 'react'

export interface TagProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
  className?: string
}

export function Tag({ children, variant = 'default', className = '' }: TagProps) {
  const variants = {
    default: 'bg-surface-elevated text-text-secondary border-border',
    primary: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    error: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

export default Tag
