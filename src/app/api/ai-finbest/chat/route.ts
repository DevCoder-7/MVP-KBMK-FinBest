import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser, parseBody } from '@/lib/api-helpers'
import { generateAIFinBestResponse } from '@/lib/ai-service'

/**
 * POST /api/ai-finbest/chat
 * Unified AI FinBest endpoint: assistant + mentor + stock analysis + bias detection
 * Uses tool-calling RAG architecture.
 *
 * Body: { sessionId?, query }
 * Returns: { sessionId, userMessage, assistantMessage (with biasDetection, toolsCalled, stockAnalysis, learningPath) }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await parseBody<{ sessionId?: string; query: string }>(req)
    if (!body?.query || body.query.trim().length === 0) {
      return NextResponse.json({ error: 'Query tidak boleh kosong' }, { status: 400 })
    }

    const user = await getDefaultUser()
    const query = body.query.trim()

    // Create or get session
    let session = body.sessionId
      ? await db.chatSession.findUnique({
          where: { id: body.sessionId, userId: user.id },
        })
      : null

    if (!session) {
      session = await db.chatSession.create({
        data: {
          userId: user.id,
          title: query.slice(0, 40),
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

    // Generate AI response (with tool-calling RAG)
    const aiResponse = await generateAIFinBestResponse(query)

    // Save assistant message
    const assistantMessage = await db.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: aiResponse.answer,
        citations: JSON.stringify(aiResponse.citations),
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
      },
    })

    // Update session title if first message
    const msgCount = await db.chatMessage.count({
      where: { sessionId: session.id },
    })
    if (msgCount === 2) {
      // first user + assistant
      await db.chatSession.update({
        where: { id: session.id },
        data: { title: query.slice(0, 40), updatedAt: new Date() },
      })
    }

    return NextResponse.json({
      sessionId: session.id,
      userMessage: {
        id: userMessage.id,
        role: 'user',
        content: query,
        createdAt: userMessage.createdAt,
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: 'assistant',
        content: aiResponse.answer,
        citations: aiResponse.citations,
        confidence: aiResponse.confidence,
        intent: aiResponse.intent,
        hasAdequateReferences: aiResponse.hasAdequateReferences,
        biasDetection: aiResponse.biasDetection,
        toolsCalled: aiResponse.toolsCalled,
        stockAnalysis: aiResponse.stockAnalysis,
        learningPath: aiResponse.learningPath,
        createdAt: assistantMessage.createdAt,
      },
    })
  } catch (error) {
    console.error('POST /api/ai-finbest/chat error:', error)
    return NextResponse.json(
      { error: 'Gagal memproses permintaan AI' },
      { status: 500 }
    )
  }
}
