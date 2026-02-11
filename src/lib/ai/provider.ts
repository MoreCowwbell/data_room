import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

export type AiProvider = 'anthropic' | 'openai' | 'google'

export const AI_PROVIDERS: Record<AiProvider, { label: string; defaultModel: string }> = {
    anthropic: { label: 'Anthropic (Claude)', defaultModel: 'claude-sonnet-4-20250514' },
    openai: { label: 'OpenAI (GPT)', defaultModel: 'gpt-4o' },
    google: { label: 'Google (Gemini)', defaultModel: 'gemini-2.0-flash' },
}

export function createModel(provider: AiProvider, apiKey: string) {
    switch (provider) {
        case 'anthropic':
            return createAnthropic({ apiKey })(AI_PROVIDERS.anthropic.defaultModel)
        case 'openai':
            return createOpenAI({ apiKey })(AI_PROVIDERS.openai.defaultModel)
        case 'google':
            return createGoogleGenerativeAI({ apiKey })(AI_PROVIDERS.google.defaultModel)
        default:
            throw new Error(`Unsupported provider: ${provider}`)
    }
}
