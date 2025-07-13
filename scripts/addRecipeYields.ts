import 'dotenv/config'; // Load environment variables first
import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import { geminiModel } from '../server/lib/clients';
import { PromptPayload } from '../server/llm/adapters';

interface RecipeData {
  id: number;
  recipe_data: any;
  title?: string;
  description?: string;
  ingredientGroups?: any[];
  instructions?: string[];
  recipeYield?: string | null;
}

const ESTIMATE_YIELD_PROMPT = `You are a recipe assistant. Estimate the yield (servings, pieces, bars, etc.) of a dish based on its ingredients and instructions.

**Instructions:**
- Output only a short yield string like "4 sandwiches", "2 burgers", "8 bars", or something like that. If no unit makes sense except for 'servings', then use 'servings'.
- Give your best reasonable estimate based on the ingredients 
- If no guess is reasonable, say "null"
- Use portion counts (e.g., number of chicken breasts, cupcakes, ramekins) to estimate
- Consider the amount of ingredients and typical serving sizes

**Recipe Data:**
Title: {title}
Description: {description}
Main Ingredients: {mainIngredients}
Instructions: {instructions}

Generate only the yield estimate, nothing else.`;

async function generateRecipeYield(recipeData: RecipeData): Promise<string | null> {
  try {
    // Extract main ingredients for context
    const mainIngredients = recipeData.ingredientGroups?.[0]?.ingredients
      ?.slice(0, 8) // Take first 8 ingredients for better context
      ?.map(ing => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim())
      ?.filter(ing => ing.length > 0)
      ?.join(', ') || '';

    // Take first 3 instructions for context
    const instructionContext = recipeData.instructions?.slice(0, 3)?.join(' ') || '';

    const prompt = ESTIMATE_YIELD_PROMPT
      .replace('{title}', recipeData.title || '')
      .replace('{description}', recipeData.description || '')
      .replace('{mainIngredients}', mainIngredients)
      .replace('{instructions}', instructionContext);

    const payload: PromptPayload = {
      system: "You are a helpful cooking assistant. Generate only the requested yield estimate.",
      text: prompt,
      isJson: false
    };

    // Set a short timeout to avoid high costs
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000); // 5 second timeout
    });

    if (!geminiModel) {
      console.log('Gemini model not initialized');
      return null;
    }

    const combinedPrompt = `${payload.system}\n\n${payload.text}`;
    const resultPromise = geminiModel.generateContent(combinedPrompt);
    
    const result = await Promise.race([resultPromise, timeoutPromise]) as any;
    
    if (!result?.response?.text) {
      console.log('No response text from Gemini');
      return null;
    }

    let yieldEstimate = result.response.text().trim();
    let finalYield = yieldEstimate;
    
    // Try to parse as JSON and extract the value if needed
    try {
      const parsed = JSON.parse(yieldEstimate);
      if (typeof parsed === 'string') {
        finalYield = parsed;
      } else if (parsed.yield) {
        finalYield = parsed.yield;
      } else if (parsed.recipeYield) {
        finalYield = parsed.recipeYield;
      }
    } catch (e) {
      // Not JSON, use as-is
    }
    finalYield = finalYield.trim();

    // Check if the response is "null" or empty
    if (finalYield.toLowerCase() === 'null' || finalYield.length === 0) {
      console.log('AI determined no reasonable yield estimate possible');
      return null;
    }

    // Validate the response is reasonable
    if (finalYield.length > 50) {
      console.log('Generated yield seems too long:', finalYield);
      return null;
    }

    return finalYield;
  } catch (error) {
    console.error('Error generating recipe yield:', error);
    return null;
  }
}

async function updateRecipeWithYield(recipeId: number, recipeYield: string): Promise<boolean> {
  try {
    // First get the current recipe data
    const { data: currentRecipe, error: fetchError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('recipe_data')
      .eq('id', recipeId)
      .single();

    if (fetchError) {
      console.error('Error fetching current recipe data:', fetchError);
      return false;
    }

    // Update the recipe_data with the new recipeYield
    const updatedRecipeData = {
      ...currentRecipe.recipe_data,
      recipeYield: recipeYield
    };

    // Update the database
    const { error } = await supabaseAdmin
      .from('processed_recipes_cache')
      .update({
        recipe_data: updatedRecipeData
      })
      .eq('id', recipeId);

    if (error) {
      console.error('Error updating recipe:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateRecipeWithYield:', error);
    return false;
  }
}

async function getRecipeById(id: number): Promise<RecipeData | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching recipe:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getRecipeById:', error);
    return null;
  }
}

async function getRecipesWithNullYield(): Promise<number[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('id, recipe_data')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipes:', error);
      return [];
    }

    // Filter recipes that have null or missing recipeYield
    const recipesWithNullYield = data?.filter(row => {
      const recipeYield = row.recipe_data?.recipeYield;
      return recipeYield === null || recipeYield === undefined || recipeYield === '';
    }) || [];

    return recipesWithNullYield.map(row => row.id);
  } catch (error) {
    console.error('Error in getRecipesWithNullYield:', error);
    return [];
  }
}

async function processSingleRecipe(recipeId: number): Promise<boolean> {
  console.log(`\n--- Processing recipe ID: ${recipeId} ---`);
  
  try {
    // Get the recipe data
    const recipe = await getRecipeById(recipeId);
    if (!recipe) {
      console.log('Recipe not found');
      return false;
    }

    // Check if recipeYield already exists and is not null
    if (recipe.recipe_data?.recipeYield && recipe.recipe_data.recipeYield !== null) {
      console.log('Recipe already has recipeYield:', recipe.recipe_data.recipeYield);
      return true;
    }

    console.log('Recipe title:', recipe.recipe_data?.title || 'No title');
    console.log('Current recipeYield:', recipe.recipe_data?.recipeYield);
    console.log('Generating yield estimate...');

    // Generate yield estimate
    const recipeYield = await generateRecipeYield(recipe.recipe_data);
    
    if (!recipeYield) {
      console.log('Failed to generate yield estimate or AI determined no estimate possible');
      return false;
    }

    console.log('Generated yield estimate:', recipeYield);

    // Update the recipe
    const success = await updateRecipeWithYield(recipeId, recipeYield);
    
    if (success) {
      console.log('✅ Successfully updated recipe with yield estimate');
    } else {
      console.log('❌ Failed to update recipe');
    }

    return success;
  } catch (error) {
    console.error('Error processing recipe:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting recipe yield estimation script...\n');

  // Test with one recipe that has null yield
  const testRecipeIds = [651]; // You can change this to test with a specific recipe
  
  for (const testRecipeId of testRecipeIds) {
    console.log(`🧪 Testing with recipe ID ${testRecipeId}...`);
    const testSuccess = await processSingleRecipe(testRecipeId);
    if (!testSuccess) {
      console.log(`❌ Test failed for recipe ${testRecipeId}, aborting further tests`);
      return;
    }
  }

  console.log('\n✅ Tests successful! Ready to process all recipes with null yields.');
  console.log('To process all recipes, uncomment the batch processing code below.');
  
  // Uncomment this section to process all recipes with null yields
  console.log('\n🔄 Processing all recipes with null yields...');
  
  const recipesWithNullYield = await getRecipesWithNullYield();
  console.log(`Found ${recipesWithNullYield.length} recipes with null yields to process`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const recipeId of recipesWithNullYield) {
    const success = await processSingleRecipe(recipeId);
    
    if (success) {
      successCount++;
    } else {
      errorCount++;
    }
    
    // Add a small delay between requests to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n📊 Processing complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

// Run the script
main().catch(console.error); 