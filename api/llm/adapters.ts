import { GeminiModel, CombinedParsedRecipe } from '../types';
import { StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';
import openai from '../lib/openai';
import { normalizeUsageMetadata } from '../utils/usageUtils';

// Define a standardized prompt shape for all models
export type PromptPayload = {
    system: string;
    text: string;
    isJson?: boolean;
    temperature?: number;
};

// Define a standardized response shape from all models
export type AdapterResponse = {
    output: string | null;
    usage: StandardizedUsage;
    error?: string | null;
};

// Define the adapter function signature
export type ModelAdapter = (
    prompt: PromptPayload,
    requestId: string,
    geminiModel?: GeminiModel
) => Promise<AdapterResponse>;


/**
 * Adapter for Google Gemini models.
 */
export const geminiAdapter: ModelAdapter = async (
    prompt: PromptPayload,
    requestId: string,
    geminiModel?: GeminiModel
): Promise<AdapterResponse> => {
    logger.info({ requestId, adapter: 'gemini', promptLength: prompt.text.length }, 'Calling Gemini Adapter');

    if (!geminiModel) {
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: 'Gemini model not provided to adapter'
        };
    }
    
    try {
        const fullPrompt = `${prompt.system}\n\n${prompt.text}`;

        if (fullPrompt.length > 150000) { 
            throw new Error(`Gemini prompt is too large (${fullPrompt.length} chars).`);
        }
        
        const result = await geminiModel.generateContent(fullPrompt);
        const response = result.response;
        const output = response.text();
        
        // Gemini doesn't provide detailed token usage in the same way,
        // so we'll have to estimate or use what's available if anything.
        // For now, returning zeroed usage until a better method is found.
        const usage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 }; 

        logger.info({ requestId, adapter: 'gemini', usage }, 'Gemini Adapter call successful');
        return {
            output: output,
            usage: usage,
            error: null
        };
    } catch (err: any) {
        logger.error({ requestId, adapter: 'gemini', error: err }, 'Gemini Adapter call failed');
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: err.message || 'Unknown Gemini error'
        };
    }
};

/**
 * Adapter for OpenAI models (GPT-4 Turbo).
 */
export const openaiAdapter: ModelAdapter = async (
    prompt: PromptPayload,
    requestId: string
): Promise<AdapterResponse> => {
    logger.info({ requestId, adapter: 'openai', promptLength: prompt.text.length }, 'Calling OpenAI Adapter');
    if (!openai) {
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: 'OpenAI client not initialized (API key might be missing)'
        };
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: prompt.system },
                { role: "user", content: prompt.text }
            ],
            temperature: prompt.temperature ?? 0.2,
            response_format: prompt.isJson ? { type: "json_object" } : undefined
        });

        const output = completion.choices[0].message.content;
        const usage = normalizeUsageMetadata({
            promptTokenCount: completion.usage?.prompt_tokens || 0,
            candidatesTokenCount: completion.usage?.completion_tokens || 0
        }, 'openai');

        logger.info({ requestId, adapter: 'openai', usage }, 'OpenAI Adapter call successful');

        return {
            output,
            usage,
            error: null
        };

    } catch (err: any) {
        logger.error({ requestId, adapter: 'openai', error: err }, 'OpenAI Adapter call failed');
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: err.message || 'Unknown OpenAI error'
        };
    }
};
