/**
 * FinBest AI - Authentication Library
 * Simple username/password auth with scrypt hashing + HMAC-signed session cookie.
 * No external dependencies required (uses Node.js built-in crypto).
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { db } from './db'

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'finbest-dev-secret-change-in-production-2026'
const COOKIE_NAME = 'finbest-session'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

// ====================== Password Hashing ======================

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const hashBuf = Buffer.from(hash, 'hex')
    const testBuf = scryptSync(password, salt, 64)
    return timingSafeEqual(hashBuf, testBuf)
  } catch {
    return false
  }
}

// ====================== Session Management ======================

function signToken(payload: string): string {
  const hmac = createHmac('sha256', SESSION_SECRET)
  hmac.update(payload)
  return `${payload}.${hmac.digest('hex')}`
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf('.')
  if (idx === -1) return null
  const payload = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = signToken(payload)
  const expectedSig = expected.slice(expected.lastIndexOf('.') + 1)
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
      ? payload
      : null
  } catch {
    return null
  }
}

/** Create a session cookie for a user */
export async function createSession(userId: string) {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + SESSION_MAX_AGE,
  })
  const encoded = Buffer.from(payload).toString('base64url')
  const token = signToken(encoded)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  })
}

/** Get the current session from cookie */
export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const encoded = verifyToken(token)
  if (!encoded) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (payload.exp < Date.now()) return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}

/** Clear the session cookie */
export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/** Get current authenticated user's UserProfile, or null */
export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null
  return db.userProfile.findUnique({ where: { id: session.userId } })
}

/**
 * Get current user or fallback to demo user.
 * Used in API routes for backward compatibility.
 * When authenticated, returns the real user; otherwise returns demo user.
 */
export async function getDefaultUser() {
  const currentUser = await getCurrentUser()
  if (currentUser) return currentUser

  // Fallback to demo user (for unauthenticated API access during transition)
  let demo = await db.userProfile.findFirst({
    where: { email: 'demo@finbest.ai' },
  })
  if (!demo) {
    demo = await db.userProfile.create({
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
  return demo
}

// ====================== User Registration ======================

/**
 * Sign in or sign up a user.
 * - If username exists: verify password → return user or "wrong password"
 * - If username doesn't exist: create account + user profile → return user
 */
export async function signInOrSignUp(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const cleanUsername = username.trim().toLowerCase()
  if (cleanUsername.length < 3) {
    return { success: false, error: 'Username minimal 3 karakter' }
  }
  if (password.length < 4) {
    return { success: false, error: 'Password minimal 4 karakter' }
  }

  // Check if account exists
  const existingAccount = await db.account.findUnique({
    where: { username: cleanUsername },
    include: { user: true },
  })

  if (existingAccount) {
    // Login: verify password
    if (!verifyPassword(password, existingAccount.password)) {
      return { success: false, error: 'Password salah. Silakan coba lagi.' }
    }
    return { success: true, userId: existingAccount.userId }
  }

  // Sign up: create new account + user profile + seed data
  const newUser = await db.userProfile.create({
    data: {
      email: `${cleanUsername}@finbest.ai`,
      name: cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1),
      riskScore: 50,
      riskProfile: 'Moderat',
      horizonYears: 10,
      annualIncome: 120_000_000,
    },
  })

  await db.account.create({
    data: {
      username: cleanUsername,
      password: hashPassword(password),
      userId: newUser.id,
    },
  })

  // Seed default data for new user
  await seedNewUserData(newUser.id)

  return { success: true, userId: newUser.id }
}

/** Seed default portfolio data for a new user */
async function seedNewUserData(userId: string) {
  // Target allocation
  await db.targetAllocation.create({
    data: {
      userId,
      saham: 35,
      obligasi: 35,
      reksadana: 20,
      kas: 5,
      emas: 5,
    },
  })

  // Default goals
  await db.goal.create({
    data: {
      userId,
      title: 'Dana Pensiun',
      targetAmount: 500_000_000,
      currentAmount: 25_000_000,
      horizonYears: 15,
      monthlyContribution: 2_000_000,
      priority: 'Tinggi',
    },
  })

  // Sample holdings (copy from demo structure)
  const assets = await db.asset.findMany()
  const defaultHoldings = [
    { ticker: 'BBCA', quantity: 100, avgCost: 9200 },
    { ticker: 'BBRI', quantity: 300, avgCost: 4500 },
    { ticker: 'TLKM', quantity: 500, avgCost: 2900 },
    { ticker: 'INDO23', quantity: 50, avgCost: 9800 },
    { ticker: 'RDSU', quantity: 500, avgCost: 1380 },
    { ticker: 'RDPU', quantity: 1000, avgCost: 1260 },
    { ticker: 'CASH', quantity: 10_000_000, avgCost: 1 },
  ]
  for (const h of defaultHoldings) {
    const asset = assets.find((a) => a.ticker === h.ticker)
    if (!asset) continue
    await db.holding.create({
      data: {
        userId,
        assetId: asset.id,
        quantity: h.quantity,
        avgCost: h.avgCost,
      },
    })
  }

  // Seed behavior metrics (30 days)
  const behaviorData: Prisma.BehaviorMetricCreateManyInput[] = []
  for (let i = 29; i >= 0; i--) {
    behaviorData.push({
      userId,
      date: new Date(Date.now() - i * 86400000),
      tractionScore: Math.max(40, Math.min(90, Math.round(65 + Math.sin(i / 4) * 12 + Math.random() * 8))),
      transactionCount: Math.floor(Math.random() * 3),
      impulsiveCount: Math.random() > 0.8 ? 1 : 0,
    })
  }
  await db.behaviorMetric.createMany({ data: behaviorData })

  // Welcome insight
  await db.insight.create({
    data: {
      userId,
      type: 'BEHAVIOR',
      title: 'Selamat datang di FinBest AI!',
      description:
        'Akun Anda telah dibuat. Lengkapi profil risiko dan alokasi target di tab Profil untuk personalisasi pengalaman. Mulai eksplorasi AI FinBest untuk analisis investasi.',
      severity: 'info',
    },
  })
}
