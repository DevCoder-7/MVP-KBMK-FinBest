/**
 * FinBest AI - API helpers
 */

import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

/** Get the default demo user (single-user mode for this prototype) */
export async function getDefaultUser() {
  let user = await db.userProfile.findFirst({
    where: { email: 'demo@finbest.ai' },
  })
  if (!user) {
    user = await db.userProfile.create({
      data: {
        email: 'demo@finbest.ai',
        name: 'Investor Demo',
        riskScore: 58,
        riskProfile: 'Moderat',
        horizonYears: 10,
        annualIncome: 180_000_000,
      },
    })
  }
  return user
}

/** Standard error response */
export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Parse JSON body safely */
export async function parseBody<T = any>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
