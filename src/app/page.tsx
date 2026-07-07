'use client'

import { useAppStore } from '@/lib/store'
import { lazy, Suspense } from 'react'
import {
  DesktopNav,
  MobileNav,
  MobileTopBar,
  DesktopTopBar,
} from '@/components/nav'
import { Footer } from '@/components/footer'
import { LogoLoading } from '@/components/logo-loading'
import { PricingSection } from '@/components/pricing-section'

// Lazy-load modules for code-splitting
const DashboardModule = lazy(() => import('@/components/modules/dashboard'))
const PortfolioModule = lazy(() => import('@/components/modules/portfolio'))
const TractionModule = lazy(() => import('@/components/modules/traction'))
const AIFinBestModule = lazy(() => import('@/components/modules/ai-finbest'))
const EdukasiModule = lazy(() => import('@/components/modules/edukasi'))
const ProfileModule = lazy(() => import('@/components/modules/profile'))

export default function Home() {
  const activeTab = useAppStore((s) => s.activeTab)

  const renderModule = () => {
    switch (activeTab) {
      case 'beranda':
        return <DashboardModule />
      case 'portofolio':
        return <PortfolioModule />
      case 'traction':
        return <TractionModule />
      case 'ai':
        return <AIFinBestModule />
      case 'edukasi':
        return <EdukasiModule />
      case 'profil':
        return <ProfileModule />
      default:
        return <DashboardModule />
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="flex flex-1">
        <DesktopNav />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DesktopTopBar />
          <MobileTopBar />
          <main className="flex-1 overflow-x-hidden overflow-y-auto pb-24 lg:pb-0 scrollbar-custom">
            <Suspense fallback={<LogoLoading />}>{renderModule()}</Suspense>
            {/* Pricing section — only on beranda (landing view), before the final footer CTA */}
            {activeTab === 'beranda' && <PricingSection />}
          </main>
        </div>
      </div>
      <Footer />
      <MobileNav />
    </div>
  )
}
