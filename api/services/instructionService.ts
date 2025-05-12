import { performance } from 'perf_hooks';

type LLMResponse<T> = {
  [K in keyof T]: T[K];
} & {
  error: string | null;
  usage: { promptTokens: number; outputTokens: number } | null;
  timeMs: number | null;
};

export async function rewriteForSubstitution(originalInstructions: string[], originalIngredientName: string, substitutedIngredientName: string, geminiModel: any): Promise<LLMResponse<{ rewrittenInstructions: string[] | null }>> {
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

export async function scaleInstructions(
  instructionsToScale: string[],
  originalIngredients: any[],
  scaledIngredients: any[],
  geminiModel: any
): Promise<LLMResponse<{ scaledInstructions: string[] | null }>> {
  const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
  const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

  const scalePrompt = `You are an expert recipe editor. You are given recipe instructions that were originally written for ingredients with these quantities: [${originalIngredientsDesc}].

The ingredients have now been scaled to new quantities: [${scaledIngredientsDesc}].

Your task is to rewrite the provided recipe instructions, carefully adjusting any specific ingredient quantities mentioned in the text to match the *new* scaled quantities. Maintain the original meaning, structure, and step count. Be precise with the numbers.

**Important Scaling Rules for Quantities:**
- For most ingredients, use the precise scaled quantity.
- However, for ingredients that are typically used whole and are not easily divisible (e.g., star anise, whole cloves, cinnamon sticks, bay leaves, an egg), if the scaled quantity results in a fraction, round it to the nearest sensible whole number. For example, if scaling results in "1 1/2 star anise", use "2 star anise" or "1 star anise" based on which is closer or makes more culinary sense. If it's "0.25 of an egg", consider if it should be omitted or rounded to 1 if critical, or if the instruction should note to use "a small amount of beaten egg". Use your culinary judgment for sensible rounding of such items.

For example, if an original instruction was "Add 2 cups flour" and the scaled ingredients now list "4 cups flour", the instruction should become "Add 4 cups flour". If an instruction mentions "the onion" and the quantity didn't change or wasn't numeric, leave it as is. Only adjust explicit numeric quantities that correspond to scaled ingredients.

Output ONLY a valid JSON object with a single key "scaledInstructions", where the value is an array of strings, each string being a single rewritten step.

Instructions to Scale (Array):
${JSON.stringify(instructionsToScale)}
`;

  const startTime = performance.now();

  try {
    if (scalePrompt.length > 100000) {
      throw new Error(`Scale prompt too large (${scalePrompt.length} chars).`);
    }

    const result = await geminiModel.generateContent(scalePrompt);
    const response = result.response;
    const responseText = response.text();

    const endTime = performance.now();
    const timeMs = endTime - startTime;

    if (responseText) {
      try {
        const parsedResult: any = JSON.parse(responseText);
        if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
          const usage = {
            promptTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0
          };
          return {
            scaledInstructions: parsedResult.scaledInstructions.map((item: any) => String(item)),
            error: null,
            usage,
            timeMs
          };
        } else {
          throw new Error("Parsed JSON result did not have the expected 'scaledInstructions' array.");
        }
      } catch (parseErr) {
        console.error('Failed to parse scaled instructions JSON from Gemini response:', parseErr);
        console.error('Raw content that failed parsing:', responseText);
        return { scaledInstructions: null, error: 'Invalid JSON format received from AI instruction scaler.', usage: null, timeMs: null };
      }
    } else {
      return { scaledInstructions: null, error: 'Empty response received from AI instruction scaler.', usage: null, timeMs: null };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown Gemini scale error';
    return { scaledInstructions: null, error: errorMessage, usage: null, timeMs: null };
  }
} 