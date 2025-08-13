import { CombinedParsedRecipe } from '../../common/types';
import { createLogger } from '../lib/logger';

const logger = createLogger('finalValidateRecipe');

/**
 * Validates the final parsed recipe object and logs warnings or info for missing fields.
 * @param recipe The recipe object to validate.
 * @param requestId A unique identifier for tracing the request.
 */
export function finalValidateRecipe(recipe: CombinedParsedRecipe | null, requestId: string): { ok: boolean; reasons?: string[] } {
  const reasons: string[] = [];

  if (!recipe) {
    logger.error({ requestId }, 'Final validation failed: Recipe object is null');
    return { ok: false, reasons: ['Recipe object is null'] };
  }

  logger.info({ 
    requestId, 
    title: recipe.title,
    hasIngredientGroups: !!recipe.ingredientGroups,
    ingredientGroupsCount: recipe.ingredientGroups?.length || 0,
    hasInstructions: !!recipe.instructions,
    instructionsCount: recipe.instructions?.length || 0,
    hasTitle: !!recipe.title
  }, 'Performing final validation on parsed recipe data');

  // Validate ingredient groups
  if (!recipe.ingredientGroups || recipe.ingredientGroups.length < 1) {
    logger.warn({ 
      requestId, 
      count: recipe.ingredientGroups?.length || 0,
      title: recipe.title 
    }, 'Final validation: Ingredient groups are missing or empty');
    reasons.push('Missing or empty ingredient groups');
  } else {
    // Check if at least one group has ingredients
    const totalIngredients = recipe.ingredientGroups.reduce((total, group) => total + (group.ingredients?.length || 0), 0);
    if (totalIngredients < 1) {
      logger.warn({ 
        requestId, 
        totalIngredients,
        title: recipe.title 
      }, 'Final validation: No ingredients found in any group');
      reasons.push('No ingredients found in ingredient groups');
    } else {
      // Check for hallucinated ingredients (too generic, vague, or placeholder-like)
      const hallucinationSigns = checkForIngredientHallucination(recipe.ingredientGroups);
      if (hallucinationSigns.length > 0) {
        // Treat most ingredient anomalies as non-fatal (log only) to reduce false negatives
        const nonFatalIngredientSigns = new Set<string>([
          'Repetitive ingredient patterns detected',
          'Too many generic ingredients detected',
          'Placeholder ingredients detected',
        ]);

        const fatalIngredientSigns = hallucinationSigns.filter(sign => !nonFatalIngredientSigns.has(sign));
        const nonFatalDetected = hallucinationSigns.filter(sign => nonFatalIngredientSigns.has(sign));

        if (nonFatalDetected.length > 0) {
          logger.info({
            requestId,
            nonFatalDetected,
            title: recipe.title,
          }, 'Final validation: Non-fatal ingredient anomalies detected');
        }

        if (fatalIngredientSigns.length > 0) {
          logger.warn({ 
            requestId, 
            hallucinationSigns: fatalIngredientSigns,
            title: recipe.title 
          }, 'Final validation: Potential ingredient hallucination detected');
          reasons.push(...fatalIngredientSigns);
        }
      }
    }
  }

  if (!recipe.instructions || recipe.instructions.length < 1) {
    logger.warn({ 
      requestId, 
      count: recipe.instructions?.length || 0,
      title: recipe.title 
    }, 'Final validation: Instructions are missing or too few');
    reasons.push('Missing or too few instructions');
  } else {
    // Check for hallucinated instructions (too generic, vague, or placeholder-like)
    const instructionHallucinationSigns = checkForInstructionHallucination(recipe.instructions);
    if (instructionHallucinationSigns.length > 0) {
      // Treat certain instruction anomalies as non-fatal (do not fail validation)
      const nonFatalInstructionSigns = new Set([
        'Placeholder instructions detected',
        'Vague instructions detected'
      ]);

      const fatalInstructionSigns = instructionHallucinationSigns.filter(sign => !nonFatalInstructionSigns.has(sign));
      const nonFatalDetected = instructionHallucinationSigns.filter(sign => nonFatalInstructionSigns.has(sign));

      if (nonFatalDetected.length > 0) {
        logger.info({
          requestId,
          nonFatalDetected,
          title: recipe.title
        }, 'Final validation: Non-fatal instruction anomalies detected');
      }

      if (fatalInstructionSigns.length > 0) {
        logger.warn({
          requestId,
          instructionHallucinationSigns: fatalInstructionSigns,
          title: recipe.title
        }, 'Final validation: Potential instruction hallucination detected');
        reasons.push(...fatalInstructionSigns);
      }
    }
  }
  
  if (!recipe.title) {
    logger.warn({ requestId }, 'Final validation: Missing title');
    reasons.push('Missing title');
  } else {
    // Check for hallucinated titles (too generic, vague, or placeholder-like)
    const titleHallucinationSigns = checkForTitleHallucination(recipe.title);
    if (titleHallucinationSigns.length > 0) {
      logger.warn({ 
        requestId, 
        titleHallucinationSigns,
        title: recipe.title 
      }, 'Final validation: Potential title hallucination detected');
      reasons.push(...titleHallucinationSigns);
    }
  }

  // Check for reasonable cooking times and yields
  const timeYieldSigns = checkForUnreasonableTimesAndYields(recipe);
  if (timeYieldSigns.length > 0) {
    logger.warn({ 
      requestId, 
      timeYieldSigns,
      title: recipe.title 
    }, 'Final validation: Unreasonable cooking times or yields detected');
    reasons.push(...timeYieldSigns);
  }

  // Check for overly perfect/unrealistic recipes (sign of hallucination)
  // Downgrade to informational only; DO NOT fail validation for these.
  const perfectionSigns = checkForOverlyPerfectRecipe(recipe);
  if (perfectionSigns.length > 0) {
    logger.info({
      requestId,
      perfectionSigns,
      title: recipe.title
    }, 'Final validation: Overly perfect recipe detected (non-fatal)');
    // Intentionally not pushing to reasons
  }

  // Log informational warnings for optional fields, but don't fail validation for them.
  const optionalFields: (keyof CombinedParsedRecipe)[] = ['recipeYield', 'prepTime', 'cookTime', 'totalTime'];
  const missingOptionalFields = optionalFields.filter(field => !recipe[field]);

  if (missingOptionalFields.length > 0) {
    logger.info({ 
      requestId, 
      missingFields: missingOptionalFields,
      title: recipe.title 
    }, 'Final validation: Optional informational fields are missing');
  }

  if (reasons.length > 0) {
    logger.error({ 
      requestId, 
      reasons,
      title: recipe.title 
    }, 'Final validation failed');
    return { ok: false, reasons };
  }

  logger.info({ 
    requestId, 
    title: recipe.title 
  }, 'Final validation passed successfully');
  return { ok: true };
}

/**
 * Checks for signs of ingredient hallucination
 */
function checkForIngredientHallucination(ingredientGroups: any[]): string[] {
  const signs: string[] = [];
  
  // Check for too many generic ingredients
  const genericIngredients = [
    'ingredients', 'seasonings', 'spices', 'herbs', 'vegetables', 'meat', 'protein',
    'dairy', 'grains', 'flour', 'oil', 'salt', 'pepper', 'water', 'broth', 'stock'
  ];
  
  let genericCount = 0;
  let totalIngredients = 0;
  const allIngredientNames: string[] = [];
  
  ingredientGroups.forEach(group => {
    if (group.ingredients) {
      group.ingredients.forEach((ingredient: any) => {
        totalIngredients++;
        const name = ingredient.name?.toLowerCase() || '';
        allIngredientNames.push(name);
        if (genericIngredients.some(generic => name.includes(generic))) {
          genericCount++;
        }
      });
    }
  });
  
  // If more than 50% of ingredients are generic, it's suspicious
  if (totalIngredients > 0 && (genericCount / totalIngredients) > 0.5) {
    signs.push('Too many generic ingredients detected');
  }
  
  // Check for placeholder ingredients
  const placeholderPatterns = [
    /ingredient/i, /item/i, /component/i, /element/i, /material/i,
    /as needed/i, /to taste/i, /optional/i, /your choice/i
  ];
  
  ingredientGroups.forEach(group => {
    if (group.ingredients) {
      group.ingredients.forEach((ingredient: any) => {
        const name = ingredient.name || '';
        if (placeholderPatterns.some(pattern => pattern.test(name))) {
          signs.push('Placeholder ingredients detected');
        }
      });
    }
  });
  
  // Check for repetitive ingredient patterns (sign of hallucination)
  const uniqueIngredients = new Set(allIngredientNames);
  if (totalIngredients > 0 && (uniqueIngredients.size / totalIngredients) < 0.7) {
    signs.push('Repetitive ingredient patterns detected');
  }
  
  // Check for unrealistic ingredient combinations
  const unrealisticCombinations = [
    ['chocolate', 'fish'], ['mint', 'beef'], ['vanilla', 'chicken'],
    ['cinnamon', 'salmon'], ['nutmeg', 'pork']
  ];
  
  const hasUnrealisticCombo = unrealisticCombinations.some(combo => {
    return combo.every(ingredient => 
      allIngredientNames.some(name => name.includes(ingredient))
    );
  });
  
  if (hasUnrealisticCombo) {
    signs.push('Unrealistic ingredient combinations detected');
  }
  
  return signs;
}

/**
 * Checks for signs of instruction hallucination
 */
function checkForInstructionHallucination(instructions: string[]): string[] {
  const signs: string[] = [];
  
  // Check for too many generic instructions
  const genericInstructions = [
    'prepare', 'cook', 'serve', 'enjoy', 'garnish', 'season', 'mix', 'combine',
    'add', 'stir', 'heat', 'bake', 'roast', 'grill', 'fry', 'simmer'
  ];
  
  let genericCount = 0;
  let totalInstructions = instructions.length;
  
  instructions.forEach(instruction => {
    const text = instruction.toLowerCase();
    const wordCount = instruction.trim().split(/\s+/).length;
    const hasGenericVerb = genericInstructions.some(generic => text.includes(generic));
    // Only consider a step "generic" if it's very short and relies on boilerplate verbs
    if (hasGenericVerb && wordCount <= 7) {
      genericCount++;
    }
  });
  
  // If more than 90% of instructions are short and generic, it's suspicious
  if (totalInstructions > 0 && (genericCount / totalInstructions) > 0.9) {
    signs.push('Too many generic instructions detected');
  }
  
  // Check for placeholder instructions
  // Treat as placeholder only if the entire instruction is effectively a placeholder,
  // not when it contains real content like "Step 1: Preheat the oven".
  const placeholderWholeLinePatterns = [
    /^instructions?\s*:?\s*$/i,
    /^directions?\s*:?\s*$/i,
    /^procedure\s*:?\s*$/i,
    /^as desired\.?$/i,
    /^to taste\.?$/i,
    /^optional\.?$/i,
    /^your preference\.?$/i,
    /^step\s*\d*\s*:?\s*$/i // line is just "Step" or "Step 1:"
  ];
  
  instructions.forEach(instruction => {
    const trimmed = instruction.trim();
    if (placeholderWholeLinePatterns.some(pattern => pattern.test(trimmed))) {
      signs.push('Placeholder instructions detected');
    }
  });
  
  // Check for overly vague instructions
  const vaguePatterns = [
    /cook until done/i, /until ready/i, /until finished/i,
    /add seasonings/i, /season to taste/i, /add flavor/i
  ];
  
  instructions.forEach(instruction => {
    if (vaguePatterns.some(pattern => pattern.test(instruction))) {
      signs.push('Vague instructions detected');
    }
  });
  
  return signs;
}

/**
 * Checks for signs of title hallucination
 */
function checkForTitleHallucination(title: string): string[] {
  const signs: string[] = [];
  
  // Check for generic/vague titles
  const genericTitlePatterns = [
    /healthy.*meal/i, /delicious.*recipe/i, /tasty.*dish/i,
    /quick.*dinner/i, /easy.*meal/i, /simple.*recipe/i,
    /pregnancy.*friendly/i, /diet.*friendly/i, /nutritious.*meal/i,
    /family.*favorite/i, /comfort.*food/i, /homemade.*recipe/i
  ];
  
  if (genericTitlePatterns.some(pattern => pattern.test(title))) {
    signs.push('Generic or vague recipe title detected');
  }
  
  // Check for placeholder titles (only when the entire title is a placeholder word)
  const placeholderWholeTitlePatterns = [
    /^recipes?$/i,
    /^dishes?$/i,
    /^meals?$/i,
    /^food$/i,
    /^cooking$/i,
    /^sample$/i,
    /^example$/i,
    /^template$/i,
    /^placeholder$/i
  ];
  
  if (placeholderWholeTitlePatterns.some(pattern => pattern.test(title.trim()))) {
    signs.push('Placeholder title detected');
  }
  
  return signs;
}

/**
 * Checks for unreasonable cooking times and yields
 */
function checkForUnreasonableTimesAndYields(recipe: CombinedParsedRecipe): string[] {
  const signs: string[] = [];
  // Time sanity checks are intentionally disabled per product decision
  // (e.g., braises, stock, or smoking can legitimately exceed many hours).
  // Keeping only the yield sanity check below.
  
  // Check for unreasonable yields
  if (recipe.recipeYield) {
    const recipeYield = recipe.recipeYield.toLowerCase();
    if (recipeYield.includes('serving')) {
      const servings = parseInt(recipeYield.match(/(\d+)/)?.[1] || '0');
      if (servings > 50) {
        signs.push('Unreasonably large yield detected');
      }
    }
  }
  
  return signs;
} 

/**
 * Checks for overly perfect or unrealistic recipes (signs of hallucination)
 */
function checkForOverlyPerfectRecipe(recipe: CombinedParsedRecipe): string[] {
  const signs: string[] = [];
  
  // Check for too many positive adjectives in title
  const positiveAdjectives = [
    'perfect', 'amazing', 'incredible', 'fantastic', 'delicious', 'mouthwatering',
    'heavenly', 'divine', 'scrumptious', 'delectable', 'sublime', 'exquisite'
  ];
  
  if (recipe.title) {
    const title = recipe.title.toLowerCase();
    const positiveCount = positiveAdjectives.filter(adj => title.includes(adj)).length;
    if (positiveCount > 2) {
      signs.push('Too many positive adjectives in title');
    }
  }
  
  // Check for unrealistic nutritional claims
  if (recipe.nutrition) {
    const nutrition = recipe.nutrition;
    
    // Check for perfect round numbers (suspicious)
    if (nutrition.calories && /^\d{2,3}0$/.test(nutrition.calories)) {
      signs.push('Suspiciously round calorie count');
    }
    
    // Check for unrealistic protein content
    if (nutrition.protein) {
      const protein = parseInt(nutrition.protein.match(/(\d+)/)?.[1] || '0');
      if (protein > 100) {
        signs.push('Unrealistic protein content');
      }
    }
  }
  
  // Check for overly detailed descriptions (sign of hallucination)
  if (recipe.description && recipe.description.length > 1500) {
    signs.push('Overly detailed description');
  }
  
  // Check for too many tips (real recipes usually have 1-3 tips)
  if (recipe.tips) {
    const tipCount = recipe.tips.split(/\.\s+/).length;
    if (tipCount > 5) {
      signs.push('Too many cooking tips');
    }
  }
  
  return signs;
} 