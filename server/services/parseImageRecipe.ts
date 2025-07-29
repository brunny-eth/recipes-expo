import { CombinedParsedRecipe } from '../../common/types';
import { createHash } from 'crypto';
import { detectInputType } from '../utils/detectInputType';
import { generateCacheKeyHash } from '../utils/hash';
import { StandardizedUsage } from '../utils/usageUtils';
import { createLogger } from '../lib/logger';
import { parseTextRecipe } from './parseTextRecipe';
import { ParseResult } from './parseRecipe';
import { runDefaultLLM, openaiAdapter } from '../llm/adapters';
import { buildImageParsePrompt } from '../llm/parsingPrompts';
import { ParseErrorCode, StructuredError } from '../../common/types/errors';
import { openai } from '../lib/clients';

const logger = createLogger('parseImageRecipe');

const MAX_IMAGE_SIZE_MB = 10;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export type ImageParseResult = ParseResult & {
    extractedText?: string;
    imageProcessingTime?: number;
};

export async function parseImageRecipe(
    imageBuffer: Buffer,
    mimeType: string,
    requestId?: string
): Promise<ImageParseResult> {
    const finalRequestId = requestId || createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
    const requestStartTime = Date.now();
    
    let overallTimings: ParseResult['timings'] = {
        dbCheck: -1,
        geminiParse: -1,
        dbInsert: -1,
        total: -1
    };
    let handlerUsage: StandardizedUsage = { inputTokens: 0, outputTokens: 0 };
    const inputType = 'image';
    
    try {
        logger.info({ 
            requestId: finalRequestId, 
            inputType, 
            imageSize: imageBuffer.length, 
            mimeType 
        }, `Received image parse request.`);

        // Validate image size
        const imageSizeMB = imageBuffer.length / (1024 * 1024);
        if (imageSizeMB > MAX_IMAGE_SIZE_MB) {
            logger.warn({ 
                requestId: finalRequestId, 
                sizeMB: imageSizeMB.toFixed(2) 
            }, 'Image too large');
            
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.INVALID_INPUT,
                    message: `Image too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`
                },
                fromCache: false,
                inputType,
                cacheKey: '',
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'N/A'
            };
        }

        // Validate image type
        if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
            logger.warn({ 
                requestId: finalRequestId, 
                mimeType, 
                supported: SUPPORTED_IMAGE_TYPES 
            }, 'Unsupported image type');
            
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.INVALID_INPUT,
                    message: 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF.'
                },
                fromCache: false,
                inputType,
                cacheKey: '',
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'N/A'
            };
        }

        // Generate cache key from image hash
        const imageHash = createHash('sha256').update(imageBuffer).digest('hex');
        const cacheKey = `image:${imageHash}`;

        logger.info({ 
            requestId: finalRequestId, 
            cacheKey, 
            sizeMB: imageSizeMB.toFixed(2) 
        }, 'Image validated, extracting text with vision model');

        // Extract text from image using Gemini Vision with GPT-4o fallback
        const visionStartTime = Date.now();
        
        // Convert buffer to base64 for vision models
        const base64Image = imageBuffer.toString('base64');
        
        const prompt = buildImageParsePrompt();
        prompt.metadata = { requestId: finalRequestId };
        
        // Add image data to the prompt
        prompt.imageData = {
            mimeType: mimeType,
            data: base64Image
        };

        let visionResponse;
        let usedFallback = false;

        try {
            // Try Gemini Vision first
            visionResponse = await runDefaultLLM(prompt);
            logger.info({ requestId: finalRequestId }, 'Gemini Vision succeeded');
        } catch (err: any) {
            logger.warn({ 
                requestId: finalRequestId, 
                error: err.message,
                geminiError: err 
            }, 'Gemini Vision failed, falling back to GPT-4o');
            
            try {
                // Fallback to GPT-4o Vision
                visionResponse = await openaiAdapter(prompt, openai);
                usedFallback = true;
                logger.info({ requestId: finalRequestId }, 'GPT-4o Vision fallback succeeded');
            } catch (fallbackErr: any) {
                logger.error({ 
                    requestId: finalRequestId, 
                    geminiError: err.message,
                    gpt4oError: fallbackErr.message 
                }, 'Both Gemini Vision and GPT-4o Vision failed');
                throw fallbackErr; // Re-throw the fallback error
            }
        }

        const visionTime = Date.now() - visionStartTime;
        handlerUsage = visionResponse.usage;

        if (visionResponse.error || !visionResponse.output) {
            const errorMsg = visionResponse.error || "Vision model returned no output";
            logger.error({ 
                requestId: finalRequestId, 
                error: errorMsg, 
                visionTime 
            }, 'Failed to extract text from image');
            
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.GENERATION_FAILED,
                    message: "Could not extract recipe text from the image. Please ensure the image contains a clear recipe."
                },
                fromCache: false,
                inputType,
                cacheKey,
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'vision_failed'
            };
        }

        const extractedText = visionResponse.output.trim();
        
        logger.info({ 
            requestId: finalRequestId, 
            extractedTextLength: extractedText.length, 
            visionTime,
            usage: handlerUsage,
            usedFallback: usedFallback,
            visionProvider: usedFallback ? 'gpt-4o' : 'gemini'
        }, 'Successfully extracted text from image');

        // Validate extracted text quality
        if (extractedText.length < 50) {
            logger.warn({ 
                requestId: finalRequestId, 
                extractedTextLength: extractedText.length 
            }, 'Extracted text too short to be a recipe');
            
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.GENERATION_EMPTY,
                    message: "The image doesn't appear to contain enough recipe text. Please try a clearer image."
                },
                fromCache: false,
                inputType,
                cacheKey,
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'vision_text_too_short',
                extractedText,
                imageProcessingTime: visionTime
            };
        }

        // Now pipe the extracted text to parseTextRecipe
        logger.info({ 
            requestId: finalRequestId, 
            extractedText: extractedText.substring(0, 200) + '...' 
        }, 'Piping extracted text to parseTextRecipe');

        const textParseResult = await parseTextRecipe(
            extractedText, 
            finalRequestId, 
            false // don't force new parse since we just extracted this
        );

        // Merge timing and usage data
        const totalTime = Date.now() - requestStartTime;
        const combinedTimings = {
            ...textParseResult.timings,
            total: totalTime
        };

        const combinedUsage: StandardizedUsage = {
            inputTokens: handlerUsage.inputTokens + textParseResult.usage.inputTokens,
            outputTokens: handlerUsage.outputTokens + textParseResult.usage.outputTokens
        };

        logger.info({ 
            requestId: finalRequestId, 
            success: !!textParseResult.recipe,
            totalTime,
            combinedUsage,
            imageProcessingTime: visionTime,
            event: 'image_parse_complete'
        }, 'Image parsing complete');

        // Structured logging for Logtail
        logger.info({
            event: 'image_parse_complete',
            processingTimeMs: visionTime,
            extractedTextLength: extractedText.length,
            success: !!textParseResult.recipe,
            usedFallback: usedFallback,
            visionProvider: usedFallback ? 'gpt-4o' : 'gemini',
            requestId: finalRequestId
        });

        // Return enhanced result with image-specific metadata
        const result: ImageParseResult = {
            ...textParseResult,
            timings: combinedTimings,
            usage: combinedUsage,
            fetchMethodUsed: usedFallback ? 'gpt4o_vision_fallback' : 'gemini_vision',
            extractedText,
            imageProcessingTime: visionTime
        };

        return result;

    } catch (err) {
        const error = err as Error;
        const totalTime = Date.now() - requestStartTime;
        
        logger.error({ 
            requestId: finalRequestId, 
            error: error.message, 
            stack: error.stack,
            totalTime
        }, 'Unhandled exception in parseImageRecipe');
        
        return {
            recipe: null,
            error: {
                code: ParseErrorCode.GENERATION_FAILED,
                message: error.message || 'Unknown error in parseImageRecipe'
            },
            fromCache: false,
            inputType,
            cacheKey: '',
            timings: { ...overallTimings, total: totalTime },
            usage: handlerUsage,
            fetchMethodUsed: 'vision_exception'
        };
    }
} 