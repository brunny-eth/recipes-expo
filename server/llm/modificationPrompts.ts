import { formatMeasurement } from '../../utils/format';
import { PromptPayload } from './adapters';
import logger from '../lib/logger';

export type IngredientChange = { from: string; to: string | null };

export function buildModificationPrompt(
    originalInstructions: string[],
    substitutions: IngredientChange[],
    originalIngredients: any[],
    scaledIngredients: any[],
    scalingFactor: number
): PromptPayload {

    // Build substitution lines (from substitutionPrompts.ts)
    const substitutionLines = substitutions.map(sub => {
        const from = sub.from?.trim();
        if (!from) {
            logger.warn({ sub }, 'Skipping substitution with empty `from` value.');
            return null;
        }

        if (!sub.to || sub.to.trim() === '') {
            // derive simple alternative names (last word and grated form)
            const words = from.split(' ');
            const base = words[words.length - 1];
            const altPhrases: string[] = [];
            if (base.toLowerCase() !== from.toLowerCase()) altPhrases.push(base);
            altPhrases.push(`grated ${base}`);
            const altLine = altPhrases.length ? `\nALSO REMOVE if referred to as: ${altPhrases.map(a => `"${a}"`).join(', ')}` : '';
            return `REMOVE: "${from}"${altLine}`;
        }
        return `REPLACE: "${from}" → "${formatMeasurement(Number(sub.to)) || sub.to}"`;
    }).filter(Boolean).join('\n');

    // Build ingredient scaling info (from scalingPrompts.ts)
    const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
    const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

    const needsSubstitution = substitutions.length > 0;
    const needsScaling = scalingFactor !== 1;

    let modificationsSection = '';
    
    if (needsSubstitution && needsScaling) {
        modificationsSection = `
INGREDIENT SUBSTITUTIONS:
${substitutionLines}

QUANTITY SCALING:
Original ingredients: [${originalIngredientsDesc}]
Scaled ingredients (${scalingFactor}x): [${scaledIngredientsDesc}]
`;
    } else if (needsSubstitution) {
        modificationsSection = `
INGREDIENT SUBSTITUTIONS:
${substitutionLines}
`;
    } else if (needsScaling) {
        modificationsSection = `
QUANTITY SCALING:
Original ingredients: [${originalIngredientsDesc}]
Scaled ingredients (${scalingFactor}x): [${scaledIngredientsDesc}]
`;
    }

    const systemPrompt = `
You are an expert recipe editor. Rewrite the cooking instructions to reflect the following modifications.

${modificationsSection}

**SUBSTITUTION RULES** (if applicable):
1. For any ingredients marked REMOVE, eliminate all mentions/usages as if never present. Update wording/preparation to reflect the fact that the ingredient is no longer present. Adjust timings/prep if needed.
2. For any ingredients marked REPLACE, update wording/preparation to use the substitute. Adjust timings/prep if needed to incorporate the new ingredient appropriately.
3. Output natural instructions without phrases like "omit" or "instead"—just the corrected steps.

**SCALING RULES** (if applicable):
4. Update **only** ingredient quantities that are explicitly stated (e.g., "2 cups flour"). Do not modify vague references like "the onion" or "some salt".
5. Use the exact scaled quantity if numeric.
6. For whole or indivisible ingredients (e.g. eggs, bay leaves, cinnamon sticks), round sensibly upwards.
7. Be precise. If the original says "Add 2 tbsp olive oil" and the scaled amount is "1 tbsp", rewrite as "Add 1 tbsp olive oil".

**COMBINED REASONING** (when both substitutions and scaling apply):
8. Consider both changes holistically. For example, if substituting chicken with tofu AND doubling the recipe, think about how cooking times, temperatures, and preparation methods might need adjustment for both the ingredient change and the quantity change.
9. Prioritize food safety and proper cooking techniques when combining substitutions with scaling.

**GENERAL RULES**:
10. Preserve step order and DO NOT number the steps.
11. Title Rewriting: Suggest a newTitle if a primary/key ingredient is significantly substituted or removed. Primary ingredients are typically those that:
    - Appear in common recipe names (e.g., "chicken" in "chicken quesadillas", "blueberry" in "blueberry muffins")
    - Are the main protein, featured fruit, or one of the defining characteristics of the dish
    - When substituted/removed, should change what the dish is called logically.
    Do NOT suggest title changes for minor/supporting ingredients (e.g., removing carrots from chicken pot pie stays "Chicken Pot Pie") or for scaling alone.
    Examples: strawberry→blueberry pancakes becomes "Blueberry Pancakes", chicken→tofu quesadillas becomes "Tofu Quesadillas", remove chicken from chicken quesadillas becomes "Quesadillas", remove Sage from a Grilled Cheese Sage Pesto Sandwich becomes "Grilled Cheese Pesto Sandwich".

Respond ONLY in valid JSON:
{ "modifiedInstructions": [ ... ], "newTitle": "string | null" }
`;

    const userPrompt = `
ORIGINAL_INSTRUCTIONS:
${originalInstructions.map(s => `- ${s}`).join('\n')}
`;

    return {
        system: systemPrompt,
        text: userPrompt,
        isJson: true,
    };
} 