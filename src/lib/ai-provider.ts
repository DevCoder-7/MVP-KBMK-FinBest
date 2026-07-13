/**
 * FinBest AI - Dual Provider Abstraction
 *
 * Free Tier: Qwen/GLM via z-ai-web-dev-sdk (GLM-4.6)
 * Pro Tier:  Gemini via Google Generative AI REST API (gemini-2.0-flash)
 *
 * Provider selection based on user's subscription tier.
 * If Gemini API key not configured, Pro tier falls back to GLM with higher limits.
 */

import ZAI from 'z-ai-web-dev-sdk'

// ====================== Types ======================
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
}

export interface AIProvider {
  name: string
  tier: 'FREE' | 'PRO'
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
}

// ====================== Free Tier: GLM-4.6 ======================
let glmClient: any = null

async function getGLMClient() {
  if (!glmClient) {
    glmClient = await ZAI.create()
  }
  return glmClient
}

export const GLMProvider: AIProvider = {
  name: 'GLM-4.6 (Qwen-compatible)',
  tier: 'FREE',
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const client = await getGLMClient()
    const response = await client.chat.completions.create({
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    })
    return response.choices?.[0]?.message?.content || ''
  },
}

// ====================== Pro Tier: Gemini ======================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export const GeminiProvider: AIProvider = {
  name: 'Gemini 2.0 Flash',
  tier: 'PRO',
  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    if (!GEMINI_API_KEY) {
      // Fallback to GLM with Pro-tier settings (higher limits)
      return GLMProvider.chat(messages, {
        temperature: options?.temperature ?? 0.4,
        maxTokens: options?.maxTokens ?? 8192,
      })
    }

    // Convert messages to Gemini format
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const body: any = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.4,
        maxOutputTokens: options?.maxTokens ?? 4096,
        topP: 0.9,
        topK: 40,
      },
    }
    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      }
    }

    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Gemini API error:', res.status, errText)
      // Fallback to GLM
      return GLMProvider.chat(messages, options)
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return text || ''
  },
}

// ====================== Provider Selection ======================
/**
 * Get the appropriate AI provider based on user's subscription tier.
 * - FREE: GLM-4.6 (lower limits, faster)
 * - PRO: Gemini 2.0 Flash (higher limits, more capable) or GLM with Pro settings
 */
export function getProvider(tier: 'FREE' | 'PRO' = 'FREE'): AIProvider {
  if (tier === 'PRO') {
    return GeminiProvider
  }
  return GLMProvider
}

/**
 * Get tier-specific limits
 */
export function getTierLimits(tier: 'FREE' | 'PRO' = 'FREE') {
  if (tier === 'PRO') {
    return {
      maxTokens: 12000, // Higher output limit
      maxMessagesPerDay: 100,
      stockAnalysisPerDay: 50,
      features: [
        'AI Mentor dengan Gemini 2.0 Flash',
        'Analisis saham tak terbatas',
        'Prediksi harga & rekomendasi mendalam',
        'Jeda Friction Gate adaptif',
        'Edukasi premium + spaced repetition',
        'Ekspor laporan PDF',
        'Prioritas support',
      ],
    }
  }
  return {
    maxTokens: 4096,
    maxMessagesPerDay: 20,
    stockAnalysisPerDay: 5,
    features: [
      'AI Mentor dengan GLM-4.6',
      'Analisis saham 5x/hari',
      'Bias detection & Traction module',
      'Edukasi dasar (8 lesson)',
      'Portofolio monitoring',
      'Community support',
    ],
  }
}
