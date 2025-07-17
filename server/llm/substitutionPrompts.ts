import { formatMeasurement } from '../../utils/format';
import { PromptPayload } from './adapters';
import logger from '../lib/logger';
import { IngredientChange } from './modificationPrompts';

// Re-export IngredientChange for other modules
export { IngredientChange };

export function buildSubstitutionPrompt(
    originalInstructions: string[],
    substitutions: IngredientChange[],
): PromptPayload {

    const substitutionLines = substitutions.map(sub => {
        const from = sub.from?.trim();
        if (!from) {
            logger.warn({ sub }, 'Skipping substitution with empty `from` value.');
            return null;
        }

        if (!sub.to) {
            // derive simple alternative names (last word and grated form)
            const words = from.split(' ');
            const base = words[words.length - 1];
            const altPhrases: string[] = [];
            if (base.toLowerCase() !== from.toLowerCase()) altPhrases.push(base);
            altPhrases.push(`grated ${base}`);
            const altLine = altPhrases.length ? `\nALSO REMOVE if referred to as: ${altPhrases.map(a => `"${a}"`).join(', ')}` : '';
            return `REMOVE: "${from}"${altLine}`;
        }

        // Handle both old format (string) and new format (object)
        if (typeof sub.to === 'string') {
            if (sub.to.trim() === '') {
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
        } else {
            // New format: object with name, amount, unit, preparation
            const toIngredient = sub.to;
            let replacementText = toIngredient.name;
            
            // Include amount and unit if available
            if (toIngredient.amount && toIngredient.unit) {
                replacementText = `${toIngredient.amount} ${toIngredient.unit} ${toIngredient.name}`;
            } else if (toIngredient.amount) {
                replacementText = `${toIngredient.amount} ${toIngredient.name}`;
            }
            
            // Include preparation if available
            if (toIngredient.preparation) {
                replacementText += ` (${toIngredient.preparation})`;
            }
            
            return `REPLACE: "${from}" → "${replacementText}"`;
        }
    }).filter(Boolean).join('\n');

    const systemPrompt = `
    You are an expert recipe editor. Rewrite the cooking instructions to reflect the following ingredient changes.

    ${substitutionLines}

    Rules:
    1. For any ingredients marked REMOVE, eliminate all mentions/usages as if never present. Update wording/preparation to reflect the fact that the ingredient is no longer present. Adjust timings/prep if needed.
    2. For any ingredients marked REPLACE, update wording/preparation to use the substitute. Adjust timings/prep if needed to incorporate the new ingredient appropriately.
    3. Preserve step order and DO NOT number the steps.
    4. Output natural instructions without phrases like "omit" or "instead"—just the corrected steps.
    5. Title Rewriting: Suggest a newTitle if a primary/key ingredient is significantly substituted or removed. Primary ingredients are typically those that:
       - Appear in common recipe names (e.g., "chicken" in "chicken quesadillas", "blueberry" in "blueberry muffins")
       - Are the main protein, featured fruit, or one of the defining characteristic of the dish
       - When substituted/removed, should change what the dish is called logically.
       Do NOT suggest title changes for minor/supporting ingredients (e.g., removing carrots from chicken pot pie stays "Chicken Pot Pie").
       Examples: strawberry→blueberry pancakes becomes "Blueberry Pancakes", chicken→tofu quesadillas becomes "Tofu Quesadillas", remove chicken from chicken quesadillas becomes "Quesadillas", remove Sage from a Grilled Cheese Sage Pesto Sandwich becomes "Grilled Cheese Pesto Sandwich".

    Respond ONLY in valid JSON:
    { "rewrittenInstructions": [ ... ], "newTitle": "string | null" }
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