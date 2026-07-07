'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TabKey =
  | 'beranda'
  | 'portofolio'
  | 'traction'
  | 'ai'        // AI FinBest: assistant + mentor + stock analysis (unified)
  | 'edukasi'   // Adaptive Learning Pathways
  | 'profil'

interface AppState {
  activeTab: TabKey
  setActiveTab: (tab: TabKey) => void
  userId: string | null
  setUserId: (id: string) => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
  /** Pending AI query — when set, switch to AI tab and prefill */
  pendingAIQuery: string | null
  setPendingAIQuery: (q: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeTab: 'beranda',
      setActiveTab: (tab) => set({ activeTab: tab }),
      userId: null,
      setUserId: (id) => set({ userId: id }),
      theme: 'light',
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      pendingAIQuery: null,
      setPendingAIQuery: (q) => set({ pendingAIQuery: q }),
    }),
    {
      name: 'finbest-storage-v2',
      partialize: (state) => ({ userId: state.userId }),
    }
  )
)
