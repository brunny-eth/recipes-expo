import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from "@google/generative-ai";
import OpenAI from 'openai';
import { GeminiModel } from '../../common/types';
import { normalizeUsageMetadata, StandardizedUsage } from '../utils/usageUtils';
import { estimateCostUSD } from '../utils/costUtils';
import logger from '../lib/logger';
import { geminiModel, openai } from '../lib/clients';

export { StandardizedUsage };

// Define a standardized prompt shape for all models
export type PromptPayload = {
    system: string;
    text: string;
    isJson?: boolean;
    temperature?: number;
    metadata?: {
        requestId: string;
        route?: string;
    };
    // Support for vision models
    imageData?: {
        mimeType: string;
        data: string; // base64 encoded image data
    };
};

/**
 * Ensures that a prompt has default values for temperature and isJson.
 * @param prompt The input prompt.
 * @returns A new prompt with defaults applied.
 */
export function withPromptDefaults(prompt: PromptPayload): PromptPayload {
    return {
        ...prompt,
        temperature: prompt.temperature ?? 0.2,
        isJson: prompt.isJson ?? true,
    };
}

// Define a standardized response shape from all models
export type AdapterResponse = {
    output: string | null;
    usage: StandardizedUsage;
    error?: string | null;
};

// Define the adapter function signature
export type ModelAdapter = (
    prompt: PromptPayload,
    model: GeminiModel | any // Allow for OpenAI client type
) => Promise<AdapterResponse>;


/**
 * Adapter for Google Gemini models.
 */
export const geminiAdapter: ModelAdapter = async (
    prompt: PromptPayload,
    geminiModel: GeminiModel
): Promise<AdapterResponse> => {
    const fullPrompt = withPromptDefaults(prompt);
    const requestId = fullPrompt.metadata?.requestId ?? 'no-id';
    const start = Date.now();
    logger.info({ requestId, adapter: 'gemini', promptLength: fullPrompt.text.length, hasImage: !!fullPrompt.imageData }, 'Calling Gemini Adapter');
    
    try {
        let result;
        
        if (fullPrompt.imageData) {
            // Vision model request with image
            const combinedPrompt = `${fullPrompt.system}\n\n${fullPrompt.text}`;
            
            if (combinedPrompt.length > 250000) { 
                throw new Error(`Gemini prompt is too large (${combinedPrompt.length} chars).`);
            }
            
            const parts = [
                { text: combinedPrompt },
                {
                    inlineData: {
                        mimeType: fullPrompt.imageData.mimeType,
                        data: fullPrompt.imageData.data
                    }
                }
            ];
            
            result = await geminiModel.generateContent(parts);
        } else {
            // Text-only request (existing behavior)
            const combinedPrompt = `${fullPrompt.system}\n\n${fullPrompt.text}`;

            if (combinedPrompt.length > 250000) { 
                throw new Error(`Gemini prompt is too large (${combinedPrompt.length} chars).`);
            }
            
            result = await geminiModel.generateContent(combinedPrompt);
        }
        
        const response = result.response;
        const output = response.text();
        

        const usage = normalizeUsageMetadata({
            promptTokenCount: response.usageMetadata?.promptTokenCount || 0,
            candidatesTokenCount: response.usageMetadata?.candidatesTokenCount || 0
          }, 'gemini');

        const totalCostUSD = estimateCostUSD(usage, 'gemini');
        logger.info({
          requestId,
          provider: 'gemini',
          route: fullPrompt.metadata?.route || 'unknown',
          inputTokenCount: usage.inputTokens,
          outputTokenCount: usage.outputTokens,
          totalCostUSD,
          timeMs: Date.now() - start,
          hasImage: !!fullPrompt.imageData
        }, 'LLM call successful');
        
        return {
            output: output,
            usage: usage,
            error: null
        };
    } catch (err: any) {
        logger.error({ requestId, adapter: 'gemini', error: err, hasImage: !!fullPrompt.imageData }, 'Gemini Adapter call failed');
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
    openaiClient: any // Assuming 'openai' is the client
): Promise<AdapterResponse> => {
    const fullPrompt = withPromptDefaults(prompt);
    const requestId = fullPrompt.metadata?.requestId ?? 'no-id';
    const start = Date.now();
    logger.info({ requestId, adapter: 'openai', promptLength: fullPrompt.text.length, hasImage: !!fullPrompt.imageData }, 'Calling OpenAI Adapter');
    if (!openaiClient) {
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: 'OpenAI client not initialized (API key might be missing)'
        };
    }

    try {
        let messages;
        let model = "gpt-4-turbo";

        if (fullPrompt.imageData) {
            // Vision model request with image - use GPT-4o for vision
            model = "gpt-4o";
            messages = [
                { role: "system", content: fullPrompt.system },
                { 
                    role: "user", 
                    content: [
                        { type: "text", text: fullPrompt.text },
                        { 
                            type: "image_url", 
                            image_url: { 
                                url: `data:${fullPrompt.imageData.mimeType};base64,${fullPrompt.imageData.data}` 
                            } 
                        }
                    ]
                }
            ];
        } else {
            // Text-only request (existing behavior)
            messages = [
                { role: "system", content: fullPrompt.system },
                { role: "user", content: fullPrompt.text }
            ];
        }

        const completion = await openaiClient.chat.completions.create({
            model,
            messages,
            temperature: fullPrompt.temperature,
            response_format: fullPrompt.isJson ? { type: "json_object" } : undefined
        });

        const output = completion.choices[0].message.content;
        const usage = normalizeUsageMetadata({
            promptTokenCount: completion.usage?.prompt_tokens || 0,
            candidatesTokenCount: completion.usage?.completion_tokens || 0
        }, 'openai');
        
        const totalCostUSD = estimateCostUSD(usage, 'openai');
        logger.info({
            requestId,
            provider: 'openai',
            route: fullPrompt.metadata?.route || 'unknown',
            inputTokenCount: usage.inputTokens,
            outputTokenCount: usage.outputTokens,
            totalCostUSD,
            timeMs: Date.now() - start,
            hasImage: !!fullPrompt.imageData,
            model: model
        }, 'LLM call successful');

        return {
            output,
            usage,
            error: null
        };

        

    } catch (err: any) {
        logger.error({ requestId, adapter: 'openai', error: err, hasImage: !!fullPrompt.imageData }, 'OpenAI Adapter call failed');
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: err.message || 'Unknown OpenAI error'
        };
    }
};

export async function runDefaultLLM(prompt: PromptPayload) {
  const fullPrompt = withPromptDefaults(prompt);
  const requestId = fullPrompt.metadata?.requestId ?? 'no-id';

  try {
    if (!geminiModel) throw new Error("Gemini model not initialized");
    const result = await geminiAdapter(fullPrompt, geminiModel);
    if (result?.output?.trim()) return result;

    logger.warn({ requestId }, 'Gemini response was empty. Falling back to OpenAI.');
  } catch (err) {
    logger.error({ requestId, err }, 'Gemini model call failed. Falling back to OpenAI.');
  }

  try {
    if (!openai) throw new Error("OpenAI model not initialized");
    return await openaiAdapter(fullPrompt, openai);
  } catch (err) {
    logger.error({ requestId, err }, 'OpenAI fallback also failed.');
    // Return a structured error, consistent with adapters
    return {
        output: null,
        usage: { inputTokens: 0, outputTokens: 0 },
        error: 'Both Gemini and OpenAI failed.'
    };
  }
}
