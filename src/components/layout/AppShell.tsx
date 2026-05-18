'use client'

import React from 'react'
import { BottomNav } from '@/components/mobile/BottomNav'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto relative bg-surface">
      {/* Status bar placeholder */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 border-b border-border bg-surface-elevated"
        style={{ height: 'var(--header-height)' }}
      >
        <span className="text-base font-semibold text-text-primary">智囊团</span>
      </header>

      {/* Content area */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--spacing-safe-bottom))' }}
      >
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  )
}
