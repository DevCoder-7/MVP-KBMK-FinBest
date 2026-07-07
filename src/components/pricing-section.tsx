'use client'

/**
 * FinBest AI — Pricing Section
 * Landing page pricing section: FREE vs PRO subscription cards.
 *
 * Renders 2 cards side-by-side (stacks on mobile):
 *  - FREE (Rp 0/bulan): GLM-4.6, 5 analisis saham/hari, 20 pesan AI/hari, ...
 *  - PRO  (Rp 99.000/bulan): Gemini 2.0 Flash, analisis tak terbatas, 100 pesan, ...
 *
 * PRO card highlighted with "Populer" badge + gold border + pine gradient header.
 * Both CTAs navigate to the Profile tab (where the SubscriptionCard handles upgrade).
 */

import { motion } from 'framer-motion'
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Clock,
  FileText,
  Brain,
  TrendingUp,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

// ====================== Tier data ======================

interface TierFeature {
  text: string
  icon: React.ComponentType<{ className?: string }>
}

interface TierPlan {
  id: 'FREE' | 'PRO'
  name: string
  price: string
  period: string
  blurb: string
  modelLabel: string
  popular: boolean
  features: TierFeature[]
  ctaLabel: string
}

const PLANS: TierPlan[] = [
  {
    id: 'FREE',
    name: 'Gratis',
    price: 'Rp 0',
    period: '/bulan',
    blurb: 'Untuk memulai perjalanan investasi yang disiplin.',
    modelLabel: 'GLM-4.6',
    popular: false,
    features: [
      { text: 'AI Mentor GLM-4.6', icon: Brain },
      { text: '5 analisis saham / hari', icon: TrendingUp },
      { text: '20 pesan AI / hari', icon: Sparkles },
      { text: '8 lesson edukasi adaptif', icon: FileText },
      { text: 'Bias detection kognitif', icon: Brain },
      { text: 'Traction module (cooling-off 60 mnt)', icon: Clock },
      { text: 'Portofolio monitoring dasar', icon: TrendingUp },
    ],
    ctaLabel: 'Mulai Gratis',
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 'Rp 99.000',
    period: '/bulan',
    blurb: 'Untuk investor serius yang ingin AI bertenaga tinggi.',
    modelLabel: 'Gemini 2.0 Flash',
    popular: true,
    features: [
      { text: 'AI Mentor Gemini 2.0 Flash', icon: Brain },
      { text: 'Analisis saham tak terbatas', icon: TrendingUp },
      { text: '100 pesan AI / hari', icon: Sparkles },
      { text: 'Cooling-off 30 detik', icon: Clock },
      { text: 'Ekspor laporan PDF', icon: FileText },
      { text: 'Prediksi harga & rekomendasi mendalam', icon: TrendingUp },
      { text: 'Prioritas support', icon: Crown },
    ],
    ctaLabel: 'Upgrade ke Pro',
  },
]

// ====================== Section ======================

export function PricingSection() {
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  const handlePickPlan = () => {
    // Navigate to Profile tab — the SubscriptionCard there handles upgrade flow
    setActiveTab('profil')
  }

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="border-t border-border/60 bg-background/40"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-16">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-gold">
            <Sparkles className="h-3 w-3" />
            Paket Langganan
          </span>
          <h2
            id="pricing-heading"
            className="mt-4 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            Pilih paket yang sesuai perjalanan Anda
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground lg:text-base">
            Mulai gratis selamanya dengan GLM-4.6, atau upgrade ke Pro untuk
            akses Gemini 2.0 Flash dengan analisis tak terbatas dan fitur
            premium.
          </p>
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>

        {/* Cards */}
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-6 lg:mt-12 lg:grid-cols-2 lg:gap-8">
          {PLANS.map((plan, idx) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              onPick={handlePickPlan}
              delay={idx * 0.08}
            />
          ))}
        </div>

        {/* Sub-note */}
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          Harga sudah termasuk PPN. Pembayaran dapat dilakukan via QRIS, transfer
          bank, atau e-wallet. Paket Pro diperpanjang otomatis setiap 30 hari
          dan dapat dibatalkan kapan saja.
        </p>
      </div>
    </section>
  )
}

// ====================== Card ======================

function PricingCard({
  plan,
  onPick,
  delay,
}: {
  plan: TierPlan
  onPick: () => void
  delay: number
}) {
  const isPro = plan.popular

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className={cn(
        'card-editorial relative flex flex-col overflow-hidden',
        isPro && 'ring-2 ring-gold/60 lg:-mt-4 lg:mb-4'
      )}
    >
      {/* "Populer" badge (PRO only) */}
      {isPro && (
        <div className="absolute right-4 top-4 z-20">
          <span className="gradient-brass inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold-foreground shadow-sm">
            <Crown className="h-3 w-3" />
            Populer
          </span>
        </div>
      )}

      {/* Header — pine gradient for PRO, subtle bg for FREE */}
      <div
        className={cn(
          'relative px-6 py-6 lg:px-8 lg:py-7',
          isPro ? 'gradient-pine text-primary-foreground' : 'bg-muted/40'
        )}
      >
        <div className="flex items-center gap-2">
          {isPro ? (
            <Crown
              className={cn('h-5 w-5', isPro ? 'text-gold' : 'text-primary')}
            />
          ) : (
            <Zap
              className={cn('h-5 w-5', isPro ? 'text-gold' : 'text-primary')}
            />
          )}
          <span
            className={cn(
              'font-serif text-lg font-semibold tracking-tight',
              isPro ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            FinBest {plan.name}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span
            className={cn(
              'font-serif text-3xl font-bold tracking-tight lg:text-4xl',
              isPro ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            {plan.price}
          </span>
          <span
            className={cn(
              'text-sm',
              isPro ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
          >
            {plan.period}
          </span>
        </div>

        <p
          className={cn(
            'mt-2 text-xs lg:text-sm',
            isPro ? 'text-primary-foreground/85' : 'text-muted-foreground'
          )}
        >
          {plan.blurb}
        </p>

        {/* Model badge */}
        <div className="mt-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
              isPro
                ? 'border-gold/40 bg-gold/15 text-gold'
                : 'border-border bg-background text-muted-foreground'
            )}
          >
            <Sparkles className="h-2.5 w-2.5" />
            {plan.modelLabel}
          </span>
        </div>
      </div>

      {/* Body — features */}
      <div className="flex flex-1 flex-col px-6 py-6 lg:px-8 lg:py-7">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Yang Anda dapatkan
        </p>

        <ul className="mt-4 space-y-3">
          {plan.features.map((feat) => {
            const Icon = feat.icon
            return (
              <li key={feat.text} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                    isPro
                      ? 'bg-gold/15 text-gold'
                      : 'bg-primary/10 text-primary'
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="flex items-center gap-1.5 text-sm text-foreground">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{feat.text}</span>
                </span>
              </li>
            )
          })}
        </ul>

        {/* CTA — pinned to bottom for alignment */}
        <div className="mt-6 pt-2">
          <Button
            type="button"
            onClick={onPick}
            size="lg"
            className={cn(
              'w-full',
              isPro
                ? 'gradient-brass text-gold-foreground hover:opacity-90 shadow-sm'
                : ''
            )}
            variant={isPro ? 'default' : 'outline'}
          >
            {plan.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p
            className={cn(
              'mt-2 text-center text-[11px]',
              isPro ? 'text-muted-foreground' : 'text-muted-foreground'
            )}
          >
            {isPro
              ? 'Aktivasi instan, batalkan kapan saja'
              : 'Tanpa kartu kredit'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
