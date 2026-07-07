'use client'

import { DISCLAIMER } from '@/lib/utils-finance'
import { ShieldCheck, AlertCircle } from 'lucide-react'

/**
 * FinBest AI sticky footer
 * Shows disclaimer and compliance info
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-sidebar text-sidebar-foreground lg:hidden">
      <div className="mx-auto max-w-7xl px-4 py-3 lg:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2 text-[11px] leading-relaxed text-white/65">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <p className="line-clamp-2 lg:line-clamp-none">
              <span className="font-medium text-white">Disclaimer:</span>{' '}
              {DISCLAIMER.slice(0, 180)}
              <span className="hidden lg:inline">{DISCLAIMER.slice(180)}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[10px] text-white/60">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-success" />
              Patuh UU PDP
            </span>
            <span>•</span>
            <span>POJK 35/2022</span>
            <span>•</span>
            <span>v1.0 Beta</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
