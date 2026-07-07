'use client'

export function LogoLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24">
      <div className="relative">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
          <img src="/logo.svg" alt="FinBest" className="h-full w-full rounded-lg object-cover" />
        </div>
        <div className="absolute inset-0 -z-10 animate-ping rounded-xl bg-primary/20" />
      </div>
      <div className="text-center">
        <p className="font-serif text-base font-medium text-foreground">
          FinBest AI
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Menyiapkan modul...
        </p>
      </div>
    </div>
  )
}
