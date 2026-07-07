'use client'

import { useAppStore } from '@/lib/store'
import {
  DesktopNav,
  MobileNav,
  MobileTopBar,
  DesktopTopBar,
} from '@/components/nav'
import { Footer } from '@/components/footer'
import { LogoLoading } from '@/components/logo-loading'

// Direct imports (no lazy loading - more stable in dev mode)
import DashboardModule from '@/components/modules/dashboard'
import PortfolioModule from '@/components/modules/portfolio'
import TractionModule from '@/components/modules/traction'
import AIFinBestModule from '@/components/modules/ai-finbest'
import EdukasiModule from '@/components/modules/edukasi'
import ProfileModule from '@/components/modules/profile'

export default function AppPage() {
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
            {renderModule()}
          </main>
        </div>
      </div>
      <Footer />
      <MobileNav />
    </div>
  )
}
