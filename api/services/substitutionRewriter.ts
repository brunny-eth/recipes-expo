import { performance } from 'perf_hooks';
import { formatMeasurement } from '../../utils/format';

type LLMResponse<T> = {
  [K in keyof T]: T[K];
} & {
  error: string | null;
  usage: { promptTokens: number; outputTokens: number } | null;
  timeMs: number | null;
};

export async function rewriteForSubstitution(originalInstructions: string[], originalIngredientName: string, substitutedIngredientName: string, geminiModel: any): Promise<LLMResponse<{ rewrittenInstructions: string[] | null }>> {
    const cleanedSubstitutedIngredientName = formatMeasurement(Number(substitutedIngredientName));

    const rewritePrompt = `
    You are an expert cooking assistant. You will rewrite cooking instructions to reflect ingredient substitutions based on user preferences.
    
    Original Ingredient: "${originalIngredientName}"
    Substituted Ingredient: "${cleanedSubstitutedIngredientName}"
    
    Consider:
    - Preparation differences (e.g. tofu may need pressing, beans may need soaking)
    - Cooking time or method changes based on the substituted ingredient
    - Flavor or texture impacts
    - Any changes in food safety or allergen concerns
    
    If no meaningful change is required, return the original steps unchanged.
    
    Respond with ONLY a valid JSON object:
    {
      "rewrittenInstructions": [ ... ] // each step as a plain string, without numbering
    }
    
    Original Instructions:
    ${originalInstructions.map(s => `- ${s}`).join('\n')}
`;

    const startTime = performance.now();

    try {
        if (rewritePrompt.length > 100000) {
            throw new Error(`Rewrite prompt too large (${rewritePrompt.length} chars).`);
        }

        const result = await geminiModel.generateContent(rewritePrompt);
        const response = result.response;
        const responseText = response.text();

        const endTime = performance.now();
        const timeMs = endTime - startTime;

        if (responseText) {
            try {
                const parsedResult: any = JSON.parse(responseText);
                if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                    const usage = {
                        promptTokens: response.usageMetadata?.promptTokenCount || 0,
                        outputTokens: response.usageMetadata?.candidatesTokenCount || 0
                    };
                    return {
                        rewrittenInstructions: parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'),
                        error: null,
                        usage,
                        timeMs
                    };
                } else {
                    throw new Error("Parsed JSON result did not have the expected structure.");
                }
            } catch (parseError) {
                console.error('Raw content that failed parsing:', responseText);
                throw parseError;
            }
        } else {
            return { rewrittenInstructions: null, error: 'Empty response received from AI instruction rewriter.', usage: null, timeMs: null };
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown Gemini rewrite error';
        return { rewrittenInstructions: null, error: errorMessage, usage: null, timeMs: null };
    }
} 