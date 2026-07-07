/**
 * POST /api/ai/chat
 * Send a chat message and get an AI RAG response.
 * Persists both user and assistant messages to DB.
 *
 * Request: { sessionId?: string, query: string }
 * Response: { sessionId, userMessage, assistantMessage }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, apiError, parseBody } from '@/lib/api-helpers'
import { generateRAGResponse } from '@/lib/ai-service'
import {
  calcNAV,
  calcAllocationByType,
  formatIDR,
  classifyRisk,
} from '@/lib/utils-finance'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Build a concise portfolio context string for the RAG prompt */
async function buildPortfolioContext(userId: string): Promise<string> {
  const [user, holdings, target] = await Promise.all([
    db.userProfile.findUnique({ where: { id: userId } }),
    db.holding.findMany({
      where: { userId },
      include: { asset: true },
    }),
    db.targetAllocation.findUnique({ where: { userId } }),
  ])
  if (!user) return ''
  const nav = calcNAV(holdings)
  const allocation = calcAllocationByType(holdings)
  const risk = classifyRisk(user.riskScore)
  return `User profile - Risk profile: ${user.riskProfile} (${user.riskScore}/100, ${risk.label}), Horizon investasi: ${user.horizonYears} tahun, NAV saat ini: ${formatIDR(nav, true)}, Alokasi aktual: SAHAM ${(allocation.SAHAM || 0).toFixed(1)}%, OBLIGASI ${(allocation.OBLIGASI || 0).toFixed(1)}%, REKSADANA ${(allocation.REKSADANA || 0).toFixed(1)}%, KAS ${(allocation.KAS || 0).toFixed(1)}%, EMAS ${(allocation.EMAS || 0).toFixed(1)}%${target ? `. Target: SAHAM ${target.saham}%, OBLIGASI ${target.obligasi}%, REKSADANA ${target.reksadana}%, KAS ${target.kas}%, EMAS ${target.emas}%` : ''}. Jumlah holding: ${holdings.length} instrumen.`
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<{
      sessionId?: string
      query?: string
      includePortfolioContext?: boolean
    }>(req)
    if (!body || !body.query || !body.query.trim()) {
      return apiError('Query tidak boleh kosong', 400)
    }
    const query = body.query.trim()
    const includePortfolio = body.includePortfolioContext !== false // default true
    const user = await getDefaultUser()

    // Gather brief portfolio context for personalized responses (when enabled)
    const portfolioContext = includePortfolio
      ? await buildPortfolioContext(user.id)
      : undefined

    // Resolve session (create if not provided)
    let session = body.sessionId
      ? await db.chatSession.findFirst({
          where: { id: body.sessionId, userId: user.id },
        })
      : null

    if (!session) {
      const title = query.length > 40 ? query.slice(0, 40) + '…' : query
      session = await db.chatSession.create({
        data: {
          userId: user.id,
          title,
        },
      })
    }

    // Save user message
    const userMessage = await db.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: query,
      },
    })

    // Generate AI response via RAG
    const ragResult = await generateRAGResponse(query, portfolioContext)

    // Save assistant message
    const assistantMessage = await db.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: ragResult.answer,
        citations: JSON.stringify(ragResult.citations),
        confidence: ragResult.confidence,
        intent: ragResult.intent,
      },
    })

    // Update session updatedAt
    await db.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      sessionId: session.id,
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        citations: ragResult.citations,
        confidence: ragResult.confidence,
        intent: ragResult.intent,
        hasAdequateReferences: ragResult.hasAdequateReferences,
        createdAt: assistantMessage.createdAt,
      },
    })
  } catch (error) {
    console.error('POST /api/ai/chat error:', error)
    return apiError('Gagal memproses pesan AI', 500)
  }
}
