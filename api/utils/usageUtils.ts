// Type definition for standardized usage data
export type StandardizedUsage = {
    inputTokens: number;
    outputTokens: number;
};

// Type definition for Gemini's specific usage metadata structure (adjust if needed based on actual SDK)
// Assuming it might be nested or null
type GeminiUsageMetadata = {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number; // Example of another potential field
} | null | undefined;

/**
 * Normalizes usage metadata from different potential AI providers (currently Gemini) 
 * into a standard format.
 * 
 * @param metadata The usage metadata object from the AI provider's response.
 * @param provider The provider name (e.g., 'gemini') - for future use.
 * @returns A StandardizedUsage object.
 */
export function normalizeUsageMetadata(
    metadata: GeminiUsageMetadata,
    provider: string = 'gemini' // Default to gemini for now
): StandardizedUsage {
    const usage: StandardizedUsage = {
        inputTokens: 0,
        outputTokens: 0
    };

    // Add logic per provider
    if (provider === 'gemini') {
        if (metadata) {
            usage.inputTokens = metadata.promptTokenCount || 0;
            usage.outputTokens = metadata.candidatesTokenCount || 0;
        }
    } 
    // else if (provider === 'openai') { ... }
    // else if (provider === 'anthropic') { ... }

    return usage;
} 