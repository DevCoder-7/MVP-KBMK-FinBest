'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowRight, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-paper">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthPageContent />
    </Suspense>
  )
}

function AuthPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/app'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('Username dan password diperlukan')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Gagal masuk')
        return
      }
      toast.success('Berhasil masuk!')
      router.push(redirect)
      router.refresh()
    } catch {
      toast.error('Gagal terhubung ke server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-border/60 bg-background/80 backdrop-blur-md px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 overflow-hidden rounded-lg border border-border">
            <img src="/logo.svg" alt="FinBest AI" className="h-full w-full object-cover" />
          </div>
          <span className="font-serif text-base font-semibold">FinBest</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke Beranda
        </Link>
      </header>

      {/* Main */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="card-editorial p-6 lg:p-8">
            {/* Logo + Title */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl gradient-blue">
                <Sparkles className="h-7 w-7 text-primary-foreground" />
              </div>
              <h1 className="font-serif text-xl font-bold tracking-tight">
                Selamat Datang di FinBest AI
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Masuk atau buat akun baru — cukup username & password
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="cth: budi_saham"
                  autoComplete="username"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loading}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Min. 3 karakter. Jika belum terdaftar, akun baru otomatis dibuat.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-foreground">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 4 karakter"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg gradient-blue px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk / Daftar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Info */}
            <div className="mt-5 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <p className="font-medium text-foreground">Coba akun demo:</p>
              <p className="mt-0.5 text-muted-foreground">
                Username: <span className="font-mono font-medium text-foreground">demo</span>
                {' · '}
                Password: <span className="font-mono font-medium text-foreground">demo</span>
              </p>
            </div>

            {/* Privacy note */}
            <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
              Dengan masuk, Anda menyetujui pemrosesan data sesuai UU PDP No. 27/2022.
              FinBest AI bersifat non-diskrisioner — keputusan investasi sepenuhnya di tangan Anda.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
