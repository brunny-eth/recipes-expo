import { formatMeasurement } from '../../utils/format';
import { PromptPayload } from './adapters';
import logger from '../lib/logger';

export type IngredientChange = { 
  from: string; 
  to: string | null | {
    name: string;
    amount: string | null;
    unit: string | null;
    preparation: string | null;
  };
};

export function buildModificationPrompt(
    originalInstructions: string[],
    substitutions: IngredientChange[],
    originalIngredients: any[],
    scaledIngredients: any[],
    scalingFactor: number,
    skipTitleUpdate?: boolean,
    ingredientGroups?: { name: string; ingredients: any[] }[]
): PromptPayload {

    // Build substitution lines (from substitutionPrompts.ts)
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

    // Build ingredient scaling info (from scalingPrompts.ts)
    const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
    const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

    const needsSubstitution = substitutions.length > 0;
    const needsScaling = scalingFactor !== 1;
    
    logger.info({ 
        skipTitleUpdate, 
        needsSubstitution, 
        needsScaling, 
        substitutionCount: substitutions.length,
        scalingFactor 
    }, '[buildModificationPrompt] Title update behavior');

    let modificationsSection = '';
    
    // Add ingredient groups section if provided
    let ingredientGroupsSection = '';
    if (ingredientGroups && ingredientGroups.length > 0) {
        const groupsText = ingredientGroups.map(group => {
            const ingredientsList = group.ingredients.map(ing => 
                `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()
            ).join(', ');
            return `"${group.name}": [${ingredientsList}]`;
        }).join('\n');
        
        ingredientGroupsSection = `
INGREDIENT GROUPS:
${groupsText}
`;
    }
    
    if (needsSubstitution && needsScaling) {
        modificationsSection = `
${ingredientGroupsSection}INGREDIENT SUBSTITUTIONS:
${substitutionLines}

QUANTITY SCALING:
Original ingredients: [${originalIngredientsDesc}]
Scaled ingredients (${scalingFactor}x): [${scaledIngredientsDesc}]
`;
    } else if (needsSubstitution) {
        modificationsSection = `
${ingredientGroupsSection}INGREDIENT SUBSTITUTIONS:
${substitutionLines}
`;
    } else if (needsScaling) {
        modificationsSection = `
${ingredientGroupsSection}QUANTITY SCALING:
Original ingredients: [${originalIngredientsDesc}]
Scaled ingredients (${scalingFactor}x): [${scaledIngredientsDesc}]
`;
    } else if (ingredientGroupsSection) {
        modificationsSection = ingredientGroupsSection;
    }

    const systemPrompt = `
You are an expert recipe editor. Rewrite the cooking instructions to reflect the following modifications.

${modificationsSection}

**PREP STEP CONSOLIDATION**:
1. Move all preparation steps (ingredient prep like chopping, marinating, grating; equipment setup like preheating oven or greasing a pan; advance prep like making a marinade) into a single initial step at the beginning.
2. Keep the rest of the cooking steps in their original order. Do not include step numbers in the output.
3. If you consolidated prep steps into the first step, label it as "Prep Step:" at the beginning. If no prep steps were consolidated, do not add this label.

**INGREDIENT GROUP EXPANSION (CRITICAL)**:
4. Always expand vague references such as "add the marinade," "mix all dressing ingredients," or "combine the sauce" into full, explicit ingredient lists from the INGREDIENT GROUPS section.
5. Match group names loosely (case-insensitive, partial match OK).
6. When expanding, always include ingredient names **with explicit unit amounts whenever available** (e.g., "Mix 1 cup flour, 1 tsp salt, and 1 tsp cumin" rather than "Mix flour, salt, and cumin").

**SUBSTITUTIONS** (if applicable):
7. For REMOVE ingredients: eliminate all mentions and adjust prep/cooking steps naturally as if they were never present.
8. For REPLACE ingredients: use the substitute directly in the instructions with appropriate prep/cook adjustments. Adjust related timings, preparation, or cooking methods as needed.
9. Do not use phrases like "omit" or "instead" — output clean, natural instructions.

**SCALING** (if applicable):
10. Update only explicit numeric ingredient quantities (e.g., "2 cups flour" → "1 cup flour").
11. Do not modify vague references like "the onion" or "some salt".
12. For whole/indivisible ingredients (e.g., eggs, bay leaves), round sensibly upward.

**COMBINED REASONING**:
13. Apply substitutions and scaling together holistically (e.g., replacing chicken with tofu AND doubling the recipe). Adjust cooking methods, timings, and food safety considerations where needed.

**TITLE REWRITING**${skipTitleUpdate ? 
`:
14. DO NOT suggest title changes. Keep newTitle as null.` :
`:
14. Suggest a newTitle only if a primary ingredient (main protein, featured fruit, or defining characteristic) is replaced or removed. Otherwise, leave as null. Examples: strawberry→blueberry pancakes → "Blueberry Pancakes", chicken→tofu quesadillas → "Tofu Quesadillas".`
}

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