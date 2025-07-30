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
import { uploadCoverImage, updateRecipeCoverImage } from './imageStorage';

const logger = createLogger('parseImageRecipe');

const MAX_IMAGE_SIZE_MB = 10;
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export interface ImageData {
    mimeType: string;
    data: string; // base64 encoded
}

export type ImageParseResult = ParseResult & {
    extractedText?: string;
    imageProcessingTime?: number;
    pagesProcessed?: number;
};

// Overloaded function signatures for single vs multiple images
export async function parseImageRecipe(
    imageBuffer: Buffer,
    mimeType: string,
    requestId?: string,
    options?: {
        uploadCoverImage?: boolean;
        imageConfidence?: 'high' | 'medium' | 'low';
        extractionMethod?: string;
    }
): Promise<ImageParseResult & { coverImageUrl?: string }>;

export async function parseImageRecipe(
    imageDataArray: ImageData[],
    requestId?: string,
    options?: {
        uploadCoverImage?: boolean;
        imageConfidence?: 'high' | 'medium' | 'low';
        extractionMethod?: string;
    }
): Promise<ImageParseResult & { coverImageUrl?: string }>;

export async function parseImageRecipe(
    imageInput: Buffer | ImageData[],
    mimeTypeOrRequestId?: string,
    requestIdOrOptions?: string | {
        uploadCoverImage?: boolean;
        imageConfidence?: 'high' | 'medium' | 'low';
        extractionMethod?: string;
    },
    options?: {
        uploadCoverImage?: boolean;
        imageConfidence?: 'high' | 'medium' | 'low';
        extractionMethod?: string;
    }
): Promise<ImageParseResult & { coverImageUrl?: string }> {
    // Parse parameters based on input type
    let imageDataArray: ImageData[];
    let requestId: string;
    let finalOptions: typeof options = {};

    if (Buffer.isBuffer(imageInput)) {
        // Single image case
        const mimeType = mimeTypeOrRequestId as string;
        requestId = (typeof requestIdOrOptions === 'string') ? requestIdOrOptions : '';
        finalOptions = (typeof requestIdOrOptions === 'object') ? requestIdOrOptions : options || {};
        
        imageDataArray = [{
            mimeType,
            data: imageInput.toString('base64')
        }];
    } else {
        // Multiple images case
        imageDataArray = imageInput;
        requestId = (typeof mimeTypeOrRequestId === 'string') ? mimeTypeOrRequestId : '';
        finalOptions = (typeof requestIdOrOptions === 'object') ? requestIdOrOptions : {};
    }

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
            imageCount: imageDataArray.length,
            imageSizes: imageDataArray.map(img => img.data.length)
        }, `Received ${imageDataArray.length > 1 ? 'multi-' : ''}image parse request.`);

        // Validate images
        if (imageDataArray.length === 0) {
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.INVALID_INPUT,
                    message: 'At least one image is required.'
                },
                fromCache: false,
                inputType,
                cacheKey: '',
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'N/A'
            };
        }

        // Validate each image
        for (let i = 0; i < imageDataArray.length; i++) {
            const imageData = imageDataArray[i];
            const imageBuffer = Buffer.from(imageData.data, 'base64');
            
            // Validate image size
            const imageSizeMB = imageBuffer.length / (1024 * 1024);
            if (imageSizeMB > MAX_IMAGE_SIZE_MB) {
                logger.warn({ 
                    requestId: finalRequestId, 
                    imageIndex: i,
                    sizeMB: imageSizeMB.toFixed(2) 
                }, `Image ${i + 1} too large`);
                
                return {
                    recipe: null,
                    error: {
                        code: ParseErrorCode.INVALID_INPUT,
                        message: `Image ${i + 1} too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`
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
            if (!SUPPORTED_IMAGE_TYPES.includes(imageData.mimeType)) {
                logger.warn({ 
                    requestId: finalRequestId, 
                    imageIndex: i,
                    mimeType: imageData.mimeType, 
                    supported: SUPPORTED_IMAGE_TYPES 
                }, `Image ${i + 1} unsupported type`);
                
                return {
                    recipe: null,
                    error: {
                        code: ParseErrorCode.INVALID_INPUT,
                        message: `Image ${i + 1} has unsupported type. Supported: ${SUPPORTED_IMAGE_TYPES.join(', ')}`
                    },
                    fromCache: false,
                    inputType,
                    cacheKey: '',
                    timings: { ...overallTimings, total: Date.now() - requestStartTime },
                    usage: handlerUsage,
                    fetchMethodUsed: 'N/A'
                };
            }
        }

        // Generate cache key
        const cacheKey = imageDataArray.length === 1 
            ? generateCacheKeyHash(imageDataArray[0].data)
            : generateCacheKeyHash(`multiimage:${imageDataArray.map(img => img.data).join('')}`);

        logger.info({ 
            requestId: finalRequestId, 
            cacheKey,
            imageCount: imageDataArray.length
        }, 'Generated cache key for image request');

        // Build prompt with image(s)
        const visionStartTime = Date.now();
        const prompt = buildImageParsePrompt(imageDataArray);

        let visionResponse;
        let usedFallback = false;

        try {
            // Try Gemini Vision first
            visionResponse = await runDefaultLLM(prompt);
            logger.info({ requestId: finalRequestId }, `Gemini Vision${imageDataArray.length > 1 ? ' (multi-image)' : ''} succeeded`);
        } catch (err: any) {
            logger.warn({ 
                requestId: finalRequestId, 
                error: err.message,
                geminiError: err 
            }, `Gemini Vision failed, falling back to GPT-4o${imageDataArray.length > 1 ? ' (multi-image)' : ''}`);
            
            try {
                // Fallback to GPT-4o Vision
                visionResponse = await openaiAdapter(prompt, openai);
                usedFallback = true;
                logger.info({ requestId: finalRequestId }, `GPT-4o Vision fallback${imageDataArray.length > 1 ? ' (multi-image)' : ''} succeeded`);
            } catch (fallbackErr: any) {
                logger.error({ 
                    requestId: finalRequestId, 
                    geminiError: err.message,
                    gpt4oError: fallbackErr.message 
                }, `Both Gemini Vision and GPT-4o Vision failed${imageDataArray.length > 1 ? ' for multi-image' : ''}`);
                throw fallbackErr;
            }
        }

        const visionTime = Date.now() - visionStartTime;
        handlerUsage = visionResponse.usage;

        if (visionResponse.error || !visionResponse.output) {
            logger.error({ 
                requestId: finalRequestId, 
                visionError: visionResponse.error 
            }, `Vision model returned error${imageDataArray.length > 1 ? ' for multi-image' : ''}`);
            
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.GENERATION_FAILED,
                    message: visionResponse.error || 'Vision model failed to process images'
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
            visionTimeMs: visionTime,
            imageCount: imageDataArray.length,
            visionProvider: usedFallback ? 'gpt-4o' : 'gemini'
        }, `Successfully extracted text from ${imageDataArray.length > 1 ? 'multiple images' : 'image'}`);

        // Validate extracted text quality
        if (extractedText.length < 50) {
            logger.warn({ 
                requestId: finalRequestId, 
                extractedTextLength: extractedText.length 
            }, `Extracted text${imageDataArray.length > 1 ? ' from multi-image' : ''} too short to be a recipe`);
            
            return {
                recipe: null,
                error: {
                    code: ParseErrorCode.GENERATION_EMPTY,
                    message: `The image${imageDataArray.length > 1 ? 's don\'t' : ' doesn\'t'} appear to contain enough recipe text. Please try clearer image${imageDataArray.length > 1 ? 's' : ''}.`
                },
                fromCache: false,
                inputType,
                cacheKey,
                timings: { ...overallTimings, total: Date.now() - requestStartTime },
                usage: handlerUsage,
                fetchMethodUsed: 'vision_text_too_short',
                extractedText,
                imageProcessingTime: visionTime,
                pagesProcessed: imageDataArray.length
            };
        }

        // Now pipe the extracted text to parseTextRecipe
        logger.info({ 
            requestId: finalRequestId, 
            extractedText: extractedText.substring(0, 200) + '...',
            imageCount: imageDataArray.length
        }, `Piping extracted ${imageDataArray.length > 1 ? 'multi-image ' : ''}text to parseTextRecipe`);

        const textParseResult = await parseTextRecipe(
            extractedText, 
            finalRequestId, 
            false, // don't force new parse - let fromImageExtraction handle fuzzy matching bypass
            { fromImageExtraction: true } // bypass fuzzy matching for image-extracted content
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
            processingTimeMs: totalTime,
            extractedTextLength: extractedText.length,
            success: !!textParseResult.recipe,
            usedFallback,
            visionProvider: usedFallback ? 'gpt-4o' : 'gemini',
            pagesProcessed: imageDataArray.length
        }, `${imageDataArray.length > 1 ? 'Multi-image' : 'Image'} processing complete`);

        // Optional: Upload first image as cover image
        let coverImageUrl: string | undefined;
        
        // Debug logging for cover image upload conditions
        logger.info({ 
            requestId: finalRequestId,
            uploadCoverImageOption: finalOptions?.uploadCoverImage,
            recipeId: textParseResult.recipe?.id,
            imageCount: imageDataArray.length,
            hasTextParseResult: !!textParseResult,
            hasRecipe: !!textParseResult.recipe
        }, 'Checking cover image upload conditions');
        
        if (finalOptions?.uploadCoverImage && textParseResult.recipe?.id && imageDataArray.length > 0) {
            logger.info({ requestId: finalRequestId }, 'Cover image upload conditions met - starting upload process');
            try {
                const firstImageBuffer = Buffer.from(imageDataArray[0].data, 'base64');
                const uploadResult = await uploadCoverImage(
                    firstImageBuffer,
                    textParseResult.recipe.id, // Recipe ID
                    imageDataArray[0].mimeType, // MIME type  
                    finalRequestId // Request ID
                );

                if (uploadResult.success && uploadResult.publicUrl && textParseResult.recipe.id) {
                    const updateResult = await updateRecipeCoverImage(
                        textParseResult.recipe.id,
                        uploadResult.publicUrl
                    );

                                    if (updateResult.success) {
                    coverImageUrl = uploadResult.publicUrl;
                    
                    // Update the recipe object with the cover image URL
                    if (textParseResult.recipe) {
                        textParseResult.recipe.image = uploadResult.publicUrl;
                    }
                    
                    logger.info({ 
                        requestId: finalRequestId,
                        recipeId: textParseResult.recipe.id,
                        coverImageUrl
                    }, `Successfully uploaded and linked cover image${imageDataArray.length > 1 ? ' from first page' : ''}`);
                } else {
                        logger.warn({ 
                            requestId: finalRequestId,
                            recipeId: textParseResult.recipe.id,
                            updateError: updateResult.error
                        }, 'Failed to update recipe with cover image');
                    }
                } else {
                    logger.warn({ 
                        requestId: finalRequestId,
                        uploadError: uploadResult.error
                    }, 'Failed to upload cover image');
                }

            } catch (uploadError: any) {
                logger.error({ 
                    requestId: finalRequestId,
                    recipeId: textParseResult.recipe.id,
                    error: uploadError.message
                }, `Unexpected error uploading cover image${imageDataArray.length > 1 ? ' from multi-image' : ''}`);
            }
        } else {
            logger.warn({ 
                requestId: finalRequestId,
                uploadCoverImageEnabled: finalOptions?.uploadCoverImage,
                hasRecipeId: !!textParseResult.recipe?.id,
                imageCount: imageDataArray.length,
                reason: !finalOptions?.uploadCoverImage ? 'uploadCoverImage option not enabled' : 
                        !textParseResult.recipe?.id ? 'no recipe ID available' : 
                        imageDataArray.length === 0 ? 'no images available' : 'unknown'
            }, 'Skipping cover image upload - conditions not met');
        }

        // Return enhanced result with image-specific metadata
        const result: ImageParseResult & { coverImageUrl?: string } = {
            ...textParseResult,
            timings: combinedTimings,
            usage: combinedUsage,
            fetchMethodUsed: usedFallback 
                ? (imageDataArray.length > 1 ? 'gpt4o_vision_multiimage' : 'gpt4o_vision_fallback')
                : (imageDataArray.length > 1 ? 'gemini_vision_multiimage' : 'gemini_vision'),
            extractedText,
            imageProcessingTime: visionTime,
            pagesProcessed: imageDataArray.length,
            coverImageUrl
        };

        return result;

    } catch (err) {
        const error = err as Error;
        const totalTime = Date.now() - requestStartTime;
        
        logger.error({ 
            requestId: finalRequestId, 
            error: error.message, 
            stack: error.stack,
            totalTime,
            imageCount: imageDataArray.length
        }, `Unhandled exception in parseImageRecipe${imageDataArray.length > 1 ? ' (multi-image)' : ''}`);
        
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
            fetchMethodUsed: 'vision_exception',
            pagesProcessed: imageDataArray.length
        };
    }
} 