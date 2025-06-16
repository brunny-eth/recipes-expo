import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from "@google/generative-ai";
import OpenAI from 'openai';
import { GeminiModel, CombinedParsedRecipe } from '../types';
import { normalizeUsageMetadata, StandardizedUsage } from '../utils/usageUtils';
import logger from '../lib/logger';

export { StandardizedUsage };

// --- Model Initialization ---

const googleApiKey = process.env.GOOGLE_API_KEY;
let geminiModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> | null = null;
if (!googleApiKey) {
  logger.error({ context: "init", missingKey: "GOOGLE_API_KEY", nodeEnv: process.env.NODE_ENV }, "GOOGLE_API_KEY environment variable is not set!");
} else {
  try {
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const geminiConfig: GenerationConfig = {
      responseMimeType: "application/json",
      temperature: 0.1,
    };
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];
    geminiModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: geminiConfig,
      safetySettings,
    });
  } catch (e) {
    logger.error({ context: "init", error: e, message: (e as Error).message, stack: (e as Error).stack }, "❌ Failed to initialize Gemini model");
  }
}

const openaiApiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
} else {
  logger.error({ context: 'init', missingKey: 'OPENAI_API_KEY', nodeEnv: process.env.NODE_ENV }, 'OPENAI_API_KEY environment variable is not set!');
}

// Define a standardized prompt shape for all models
export type PromptPayload = {
    system: string;
    text: string;
    isJson?: boolean;
    temperature?: number;
    metadata?: {
        requestId: string;
    };
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
    model: GeminiModel | any // Allow for OpenAI client type
) => Promise<AdapterResponse>;


/**
 * Adapter for Google Gemini models.
 */
export const geminiAdapter: ModelAdapter = async (
    prompt: PromptPayload,
    geminiModel: GeminiModel
): Promise<AdapterResponse> => {
    const requestId = prompt.metadata?.requestId ?? 'no-id';
    logger.info({ requestId, adapter: 'gemini', promptLength: prompt.text.length }, 'Calling Gemini Adapter');
    
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
    openaiClient: any // Assuming 'openai' is the client
): Promise<AdapterResponse> => {
    const requestId = prompt.metadata?.requestId ?? 'no-id';
    logger.info({ requestId, adapter: 'openai', promptLength: prompt.text.length }, 'Calling OpenAI Adapter');
    if (!openaiClient) {
        return {
            output: null,
            usage: { inputTokens: 0, outputTokens: 0 },
            error: 'OpenAI client not initialized (API key might be missing)'
        };
    }

    try {
        const completion = await openaiClient.chat.completions.create({
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

export async function runDefaultLLM(prompt: PromptPayload) {
  const requestId = prompt.metadata?.requestId ?? 'no-id';

  try {
    if (!geminiModel) throw new Error("Gemini model not initialized");
    const result = await geminiAdapter(prompt, geminiModel);
    if (result?.output?.trim()) return result;

    logger.warn({ requestId }, 'Gemini response was empty. Falling back to OpenAI.');
  } catch (err) {
    logger.error({ requestId, err }, 'Gemini model call failed. Falling back to OpenAI.');
  }

  try {
    if (!openai) throw new Error("OpenAI model not initialized");
    return await openaiAdapter(prompt, openai);
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
