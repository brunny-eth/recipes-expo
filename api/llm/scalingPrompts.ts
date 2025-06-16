import { PromptPayload } from './adapters';

export function buildScalingPrompt(
    instructionsToScale: string[],
    originalIngredients: any[],
    scaledIngredients: any[],
): PromptPayload {
    const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
    const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

    const systemPrompt = `
You are an expert recipe editor. Your task is to rewrite recipe instructions to reflect changes in ingredient quantities.

Original ingredients: [${originalIngredientsDesc}]
Scaled ingredients: [${scaledIngredientsDesc}]

Update **only** ingredient quantities that are explicitly stated (e.g., "2 cups flour"). Do not modify vague references like "the onion" or "some salt".

**Rules**:
- Use the exact scaled quantity if numeric.
- For whole or indivisible ingredients (e.g. eggs, bay leaves, cinnamon sticks), round sensibly upwards.
- Be precise. If the original says "Add 2 tbsp olive oil" and the scaled amount is "1 tbsp", rewrite as "Add 1 tbsp olive oil".

Respond with ONLY a valid JSON object:
{
  "scaledInstructions": [ ... ] // same number of steps, rewritten for new quantities
}
`;

    const userPrompt = `
Original Instructions:
${instructionsToScale.map(s => `- ${s}`).join('\n')}
`;
    return {
        system: systemPrompt,
        text: userPrompt,
        isJson: true,
    };
} 