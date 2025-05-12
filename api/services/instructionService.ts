import { performance } from 'perf_hooks';

export async function rewriteForSubstitution(originalInstructions: string[], originalIngredientName: string, substitutedIngredientName: string, geminiModel: any): Promise<{ rewrittenInstructions: string[] | null; error: string | null; usage: { promptTokens: number; outputTokens: number } | null; timeMs: number | null }> {
    const rewritePrompt = `You are an expert cooking assistant. You are given recipe instructions and a specific ingredient substitution.
Original Ingredient: ${originalIngredientName}
Substituted Ingredient: ${substitutedIngredientName}

Your task is to rewrite the original instructions to accommodate the substituted ingredient. Consider:
- **Preparation differences:** Does the substitute need different prep (e.g., pressing tofu, soaking beans)? Add or modify steps accordingly.
- **Cooking time/temperature:** Adjust cooking times and temperatures if the substitute cooks differently.
- **Liquid adjustments:** Might the substitute absorb more or less liquid?
- **Flavor profile:** Keep the core recipe goal, but account for flavor changes if necessary (though focus primarily on process).
- **Safety:** Ensure the rewritten steps are safe and make culinary sense.

Rewrite the steps clearly. Output ONLY a valid JSON object with a single key "rewrittenInstructions", where the value is an array of strings, each string being a single step without numbering.

Original Instructions (Array):
${JSON.stringify(originalInstructions)}
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