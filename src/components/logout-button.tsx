'use client'

/**
 * AppLogoutButton
 *
 * Tombol "Keluar" untuk mengakhiri sesi demo dan kembali ke halaman masuk.
 */

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface AppLogoutButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  label?: string
}

export function AppLogoutButton({
  className,
  variant = 'outline',
  size = 'default',
  label = 'Keluar',
}: AppLogoutButtonProps) {
  const router = useRouter()
  const setUserId = useAppStore((s) => s.setUserId)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    setLoading(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST' }).catch(() => null)
      setUserId('')
      window.localStorage.removeItem('finbest-storage-v2')
      toast.success('Sesi diakhiri. Sampai jumpa kembali di FinBest AI.')
      setOpen(false)
      router.replace('/masuk')
      router.refresh()
    } catch (err) {
      setLoading(false)
      toast.error('Gagal mengakhiri sesi. Silakan coba lagi.')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(
            'gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive',
            className
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Akhiri sesi FinBest AI?</AlertDialogTitle>
          <AlertDialogDescription>
            Anda akan keluar dari aplikasi. Data portofolio dan riwayat tetap
            tersimpan di perangkat ini. Anda dapat masuk kembali kapan saja.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleLogout()
            }}
            disabled={loading}
            className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengakhiri...
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Ya, Keluar
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
