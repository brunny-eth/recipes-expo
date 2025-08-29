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

export type VariationType = 'low_fat' | 'higher_protein' | 'gluten_free' | 'dairy_free' | 'vegetarian' | 'easier_recipe';

export function buildVariationPrompt(
    recipeData: any,
    variationType: VariationType
): PromptPayload {
    const variationDescriptions = {
        'low_fat': 'Create a healthier version by reducing fat, sugar, and calories while maintaining flavor. Replace high-fat ingredients with lower-fat alternatives. Use lean proteins, reduce added sugars, and increase vegetable content.',
        'higher_protein': 'Boost protein content using lean sources while maintaining the original recipe structure. Add or increase lean proteins like chicken, turkey, fish, eggs, or plant-based proteins. Maintain similar cooking times and flavor profiles.',
        'gluten_free': 'Remove all gluten-containing ingredients and replace with gluten-free alternatives. Ensure no cross-contamination while preserving the original taste and texture.',
        'dairy_free': 'Remove all dairy products and replace with non-dairy alternatives while maintaining taste and texture. Consider nutritional balance when making substitutions.',
        'vegetarian': 'Replace ALL meat, poultry, and fish ingredients with vegetarian alternatives. For each animal-based protein, substitute with a plant-based protein that provides similar texture and flavor (e.g., beef → lentils/beans, chicken → tofu/tempeh, fish/shrimp → tofu/tempeh/seitan). Also remove or replace any sauces, broths, or condiments that contain fish (like fish sauce, oyster sauce, or anchovy paste). Maintain nutritional value and recipe balance.',
        'easier_recipe': 'Create a simpler, faster, and less cleanup-intensive version of the recipe. Reduce preparation and cooking time, minimize the number of pots/pans needed, use convenient store-bought alternatives where appropriate, and simplify techniques while maintaining the core flavors and appeal of the dish. Focus on making it more accessible for busy people or less experienced cooks.'
    };

    const variationRules = {
        'low_fat': [
            'Replace butter/oil with smaller amounts of healthy oils or broth',
            'Use low-fat dairy products or dairy alternatives',
            'Remove or reduce fatty cuts of meat',
            'Use lean proteins like skinless chicken breast, turkey, or fish',
            'Replace frying with baking, grilling, or steaming',
            'Use herbs, spices, and citrus for flavor instead of fats',
            'Reduce or replace sugary sauces and dressings',
            'Increase vegetable content for bulk and nutrition',
            'Use whole grains instead of refined grains where appropriate'
        ],
        'higher_protein': [
            'Add or increase lean protein portions (chicken, turkey, fish, eggs, tofu)',
            'Replace some carbohydrates with protein-rich alternatives',
            'Use Greek yogurt instead of regular yogurt or sour cream',
            'Add protein-rich vegetables like spinach, broccoli, or edamame',
            'Include nuts, seeds, or cheese for protein boosts where appropriate',
            'Consider adding protein powder to smoothies or baked goods',
            'Maintain original cooking times and flavor profiles'
        ],
        'gluten_free': [
            'Replace wheat flour with gluten-free flour blends',
            'Replace regular pasta with rice, quinoa, or gluten-free pasta',
            'Replace bread with gluten-free bread or alternatives',
            'Use gluten-free oats and cereals',
            'Replace soy sauce with tamari or gluten-free soy sauce',
            'Check all packaged ingredients for gluten content',
            'Avoid malt vinegar, beer, stock cubes, panko, breaded items',
            'Replace flour in roux/sauces with cornstarch, arrowroot, or gluten-free flour blends'
        ],
        'dairy_free': [
            'Replace milk with almond, soy, oat, or coconut milk',
            'Replace butter with vegan butter, coconut oil, or olive oil (avoid ghee/clarified butter)',
            'Replace cheese with dairy-free cheese alternatives',
            'Replace yogurt with coconut or almond yogurt',
            'Replace cream with coconut cream or cashew cream',
            'Replace ice cream with dairy-free alternatives',
            'Check processed foods for casein or whey ingredients and replace with dairy-free alternatives'
        ],
        'vegetarian': [
            'MANDATORY: Replace ALL meat, poultry, and seafood with appropriate vegetarian alternatives based on dish context - do not leave any animal protein in the recipe',
            'For ROASTS and LARGE CUTS (beef brisket, pork shoulder, lamb): Use cauliflower, eggplant, portobello mushrooms, or seitan - these provide similar hearty texture and absorb flavors well',
            'For GROUND MEAT (beef, turkey, pork in burgers/meatballs): Use lentils, black beans, chickpeas, or crumbled tofu/firm tofu - these work best when seasoned heavily',
            'For CHICKEN BREAST/FILLET: Use firm tofu, tempeh, or seitan - slice similarly and consider marinating for flavor absorption',
            'For FISH/SEAFOOD: Use firm tofu, tempeh, seitan, or mushrooms - match the delicate texture and consider seaweed for briny notes',
            'For SAUSAGES/HOT DOGS: Use vegetarian sausage alternatives, seitan, or marinated tofu',
            'For BACON: Use coconut bacon, tempeh bacon, or smoked tofu',
            'Use vegetable broth, mushroom broth, or water with bouillon instead of meat broth',
            'Use eggs or cheese for protein where appropriate (these are vegetarian)',
            'Replace gelatin with agar-agar',
            'Use vegetarian Worcestershire sauce or alternatives',
            'Replace fish sauce with soy sauce, tamari, or coconut aminos',
            'Replace oyster sauce with mushroom-based stir-fry sauce',
            'Remove or replace anchovy paste with capers, olives, or miso paste',
            'Check all sauces and condiments for hidden animal ingredients',
            'ENSURE: Every ingredient in the final recipe must be vegetarian - double-check for any remaining meat/fish/seafood'
        ],
        'easier_recipe': [
            'Reduce total cooking/prep time by using easier techniques and store-bought ingredients while maintaining core flavors',
            'Minimize number of pots/pans needed (ideally 1-2 max, if the recipe allows it)',
            'Replace homemade components with store-bought alternatives (fresh pasta → boxed pasta, homemade stock → bouillon cubes, pasta sauce -> jarred pasta sauce)',
            'Simplify cooking techniques (baking → stovetop, complex sauces → simple seasonings)',
            'Reduce or eliminate lengthy marinating/resting times',
            'Replace specialty ingredients with common pantry staples',
            'Reduce complex knife work (dicing → chopping, julienning → slicing)',
            'Use one-pot/one-pan cooking methods when possible',
            'Focus on weeknight-friendly timing (under 45 minutes total when possible)'
        ]
    };

    const systemPrompt = `
You are an expert recipe modifier specializing in dietary adaptations. Modify the provided recipe to satisfy the ${variationType} dietary requirement.

**DIETARY REQUIREMENT**: ${variationDescriptions[variationType]}

**SPECIFIC RULES FOR THIS VARIATION**:
${variationRules[variationType].map(rule => `- ${rule}`).join('\n')}

**GENERAL MODIFICATION GUIDELINES**:
1. Maintain the original recipe's flavor profile and texture as much as possible
2. Keep preparation and cooking times similar
3. Preserve the recipe's cultural authenticity when possible
4. Only modify ingredients that conflict with the dietary requirement
5. Provide clear, detailed instructions that anyone can follow
6. Update the recipe title to reflect the dietary modification

**INGREDIENT FORMATTING RULES**:
7. **Ingredient Names**: The 'name' field should contain ONLY the core ingredient name without quantities, units, or preparation instructions (e.g., "rice noodles", not "12 ounces dried rice noodles")
8. **Preparation Instructions**: Place any specific preparation instructions into the 'preparation' field (e.g., "finely chopped", "diced", "room temperature")
9. **Amount Conversion**: Convert all fractional amounts to decimal equivalents (e.g., "1/2" → "0.5", "1 1/2" → "1.5")
10. **Content Filtering**: Exclude all brand names, promotional text, and irrelevant details from ingredient names
11. **Unit Consistency**: Use US customary units consistently (teaspoons/tablespoons/cups) or metric units consistently (ml/liter/g/kg). Avoid mixing unit systems in the same recipe.

**INGREDIENT SUBSTITUTION PRINCIPLES**:
12. Choose substitutes with similar cooking properties (e.g., texture, cooking time)
13. Match flavors closely when possible
14. Consider nutritional balance and meal satisfaction
15. Prefer whole food alternatives over processed substitutes

**INGREDIENT SUBSTITUTIONS**:
ONLY generate substitutions for ingredients that were actually CHANGED to meet the dietary requirement. For example:
- If bacon was replaced with tofu bacon → generate substitutions for tofu bacon
- If spices remain unchanged → set suggested_substitutions to null for those ingredients
- If an ingredient was completely removed → set suggested_substitutions to null

Do NOT generate substitutions for ingredients that were not modified by this dietary change. Suggest 1–2 realistic substitutions as fully filled-out objects only for modified ingredients. For meat, seafood, and poultry replacements, try to give at least 1 vegetarian substitution. NEVER include substitutions with all fields null.

**RESPONSE FORMAT**:
Respond ONLY in valid JSON with the complete modified recipe:
{
  "title": "Modified recipe title",
  "description": "Brief description of changes made",
  "ingredientGroups": [
    {
      "name": "group name",
      "ingredients": [
        {
          "name": "ingredient name",
          "amount": "quantity",
          "unit": "measurement unit",
          "preparation": "prep notes (optional)",
          "suggested_substitutions": [
            {
              "name": "string",
              "amount": "string | number | null",
              "unit": "string | null",
              "description": "string | null"
            }
          ] | null
        }
      ]
    }
  ],
  "instructions": ["step 1", "step 2", "etc."],
  "recipeYield": "serving information",
  "cookTime": "cooking time (optional)",
  "prepTime": "prep time (optional)",
  "totalTime": "total time (optional)"
}
`;

    const userPrompt = `
ORIGINAL RECIPE TO MODIFY:
Title: ${recipeData.title || 'Unknown'}
Description: ${recipeData.description || 'No description'}

INGREDIENTS:
${recipeData.ingredientGroups ? recipeData.ingredientGroups.map((group: any) => {
    const ingredients = group.ingredients.map((ing: any) =>
        `- ${ing.amount || ''} ${ing.unit || ''} ${ing.name}${ing.preparation ? ` (${ing.preparation})` : ''}`.trim()
    ).join('\n');
    return `${group.name}:\n${ingredients}`;
}).join('\n\n') : 'No ingredient groups available'}

INSTRUCTIONS:
${recipeData.instructions ? recipeData.instructions.map((step: string, index: number) => `${index + 1}. ${step}`).join('\n') : 'No instructions available'}

SERVINGS: ${recipeData.recipeYield || 'Not specified'}
COOK TIME: ${recipeData.cookTime || 'Not specified'}
PREP TIME: ${recipeData.prepTime || 'Not specified'}
`;

    return {
        system: systemPrompt,
        text: userPrompt,
        isJson: true,
    };
}

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
            const numericAmount = parseFloat(sub.to);
            const formattedAmount = !isNaN(numericAmount) ? formatMeasurement(numericAmount) : sub.to;
            return `REPLACE: "${from}" → "${formattedAmount}"`;
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

**INGREDIENT GROUP EXPANSION (REQUIRED)**:
4. When INGREDIENT GROUPS are provided, ALWAYS expand vague references such as "add the marinade," "mix all dressing ingredients," or "combine the sauce" into full, explicit ingredient lists from the INGREDIENT GROUPS section.
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