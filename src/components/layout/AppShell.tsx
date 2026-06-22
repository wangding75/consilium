'use client'

import React from 'react'
import { BottomNav } from '@/components/mobile/BottomNav'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto relative bg-white">
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-[18px] text-[13px] font-bold text-[#050816] bg-white"
        style={{ height: '40px', paddingTop: '12px' }}
      >
        <span>9:41</span>
        <div className="flex items-center gap-[6px]" aria-hidden="true">
          <span className="signal-icons flex items-end gap-[2px]">
            <span className="block w-[3px] h-[4px] bg-[#111] rounded-[3px]" />
            <span className="block w-[3px] h-[6px] bg-[#111] rounded-[3px]" />
            <span className="block w-[3px] h-[9px] bg-[#111] rounded-[3px]" />
            <span className="block w-[3px] h-[12px] bg-[#111] rounded-[3px]" />
          </span>
          <span className="wifi-icon w-[15px] h-[11px] relative">
            <span className="absolute left-1/2 -translate-x-1/2 top-0 w-[14px] h-[14px] border-2 border-[#111] border-t-[#111] border-x-transparent border-b-transparent rounded-full" />
            <span className="absolute left-1/2 -translate-x-1/2 top-[5px] w-[8px] h-[8px] border-2 border-[#111] border-t-[#111] border-x-transparent border-b-transparent rounded-full" />
          </span>
          <span className="battery-icon w-[23px] h-[12px] border-2 border-[#111] rounded-[4px] relative ml-0">
            <span className="absolute right-[-4px] top-[3px] w-[2px] h-[5px] bg-[#111] rounded-r-[2px]" />
            <span className="absolute left-[2px] top-[2px] bottom-[2px] w-[14px] rounded-[2px] bg-[#111]" />
          </span>
        </div>
      </div>

      {/* Content area */}
      <main
        className="flex-1 overflow-y-auto bg-white"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--spacing-safe-bottom))' }}
      >
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  )
}
