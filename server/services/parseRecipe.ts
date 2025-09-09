import { GeminiModel } from '../../common/types';
import { CombinedParsedRecipe } from '../../common/types/dbOverrides';
import { createHash } from 'crypto';
import { detectInputType, InputType } from '../utils/detectInputType';
import { generateCacheKeyHash } from '../utils/hash';
import { StandardizedUsage } from '../utils/usageUtils';
import { createLogger } from '../lib/logger';
import { parseUrlRecipe } from './parseUrlRecipe';
import { parseTextRecipe } from './parseTextRecipe';
import { parseVideoRecipe } from './parseVideoRecipe';
import { parseImageRecipe } from './parseImageRecipe';
import { StructuredError, ParseErrorCode } from '../../common/types/errors';

const logger = createLogger('parseRecipe');

export type ParseResult = {
    recipe: CombinedParsedRecipe | null;
    error: StructuredError | null;
    fromCache: boolean;
    inputType: InputType;
    cacheKey: string;
    timings: {
        dbCheck: number;
        fetchHtml?: number;
        extractContent?: number;
        prepareText?: number;
        geminiParse: number;
        dbInsert: number;
        total: number;
    };
    usage: StandardizedUsage;
    fetchMethodUsed?: string;
    cachedMatches?: { recipe: CombinedParsedRecipe; similarity: number; }[]; // NEW FIELD
};

export async function parseAndCacheRecipe(
    input: string,
    forceNewParse?: boolean,
    isDishNameSearch?: boolean
): Promise<ParseResult> {
    const requestId = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
    const requestStartTime = Date.now();

    try {
        if (!input || typeof input !== 'string' || input.trim() === '') {
            logger.warn({ requestId }, 'Invalid request: Missing or empty "input" in request body.');
            return { 
                recipe: null, 
                error: {
                    code: ParseErrorCode.INVALID_INPUT,
                    message: 'Missing or empty "input" in request body'
                },
                fromCache: false, 
                inputType: 'raw_text',
                cacheKey: '', 
                timings: { dbCheck: -1, geminiParse: -1, dbInsert: -1, total: Date.now() - requestStartTime }, 
                usage: { inputTokens: 0, outputTokens: 0 }, 
                fetchMethodUsed: 'N/A' 
            };
        }

        const trimmedInput = input.trim();
        const inputType = detectInputType(trimmedInput);

        const SUPPORTED_INPUT_TYPES: ReadonlyArray<InputType> = ['url', 'raw_text', 'video', 'image'];
        if (!SUPPORTED_INPUT_TYPES.includes(inputType)) {
            const errorMsg = `Unsupported input type detected: ${inputType}`;
            logger.error({ requestId, inputTypeRec: inputType }, errorMsg);
            return {
                recipe: null,
                error: {
                  code: ParseErrorCode.UNSUPPORTED_INPUT_TYPE,
                  message: "We don't support that kind of input yet. Please paste text or a link to a recipe."
                },
                fromCache: false,
                inputType: inputType,
                cacheKey: generateCacheKeyHash(trimmedInput), 
                timings: { dbCheck: -1, geminiParse: -1, dbInsert: -1, total: Date.now() - requestStartTime },
                usage: { inputTokens: 0, outputTokens: 0 },
                fetchMethodUsed: 'N/A'
            };
        }

        if (inputType === 'url') {
            return await parseUrlRecipe(trimmedInput);
        } else if (inputType === 'video') {
            return await parseVideoRecipe(trimmedInput);
        } else { // 'raw_text'
            return await parseTextRecipe(trimmedInput, requestId, forceNewParse, { isDishNameSearch });
        }

    } catch (err) {
        const error = err as Error;
        const totalTime = Date.now() - requestStartTime;
        logger.error({ 
            requestId, 
            error: error.message, 
            stack: error.stack,
            inputType: detectInputType(input),
            inputLength: input?.length || 0,
            totalTime 
        }, 'Unhandled exception in parseAndCacheRecipe dispatcher');
        return {
            recipe: null,
            error: {
              code: ParseErrorCode.GENERATION_FAILED,
              message: "We couldn't find any similar recipes. Try pasting a recipe link instead."
            },
            fromCache: false,
            inputType: detectInputType(input),
            cacheKey: input.startsWith('http') ? input : generateCacheKeyHash(input),
            timings: { dbCheck: -1, geminiParse: -1, dbInsert: -1, total: totalTime },
            usage: { inputTokens: 0, outputTokens: 0 },
            fetchMethodUsed: 'N/A'
        };
    }
} 