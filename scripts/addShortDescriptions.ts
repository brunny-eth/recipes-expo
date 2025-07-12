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
}

const SHORT_DESCRIPTION_PROMPT = `You are an expert recipe description generator. Your task is to create a short, vivid description of a dish based on its recipe data.

**Requirements:**
- Write a <10 word, vivid, natural-language description
- Focus on the main flavors, ingredients, or cooking method
- Avoid promotional or filler text
- Be appetizing and descriptive
- Examples: "Cheesy quesadillas with smoky adobo ranch", "Creamy pasta with fresh herbs and lemon"

**Recipe Data:**
Title: {title}
Description: {description}
Main Ingredients: {mainIngredients}
Instructions: {instructions}

Generate only the short description, nothing else.`;

async function generateShortDescription(recipeData: RecipeData): Promise<string | null> {
  try {
    // Extract main ingredients for context
    const mainIngredients = recipeData.ingredientGroups?.[0]?.ingredients
      ?.slice(0, 5) // Take first 5 ingredients
      ?.map(ing => ing.name)
      ?.join(', ') || '';

    // Take first 2 instructions for context
    const instructionContext = recipeData.instructions?.slice(0, 2)?.join(' ') || '';

    const prompt = SHORT_DESCRIPTION_PROMPT
      .replace('{title}', recipeData.title || '')
      .replace('{description}', recipeData.description || '')
      .replace('{mainIngredients}', mainIngredients)
      .replace('{instructions}', instructionContext);

    const payload: PromptPayload = {
      system: "You are a helpful cooking assistant. Generate only the requested short description.",
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

    let shortDescription = result.response.text().trim();
    let finalDescription = shortDescription;
    // Try to parse as JSON and extract the value if needed
    try {
      const parsed = JSON.parse(shortDescription);
      if (typeof parsed === 'string') {
        finalDescription = parsed;
      } else if (parsed.description) {
        finalDescription = parsed.description;
      } else if (parsed.short_description) {
        finalDescription = parsed.short_description;
      }
    } catch (e) {
      // Not JSON, use as-is
    }
    finalDescription = finalDescription.trim();

    // Validate the response is reasonable
    if (finalDescription.length > 100 || finalDescription.length < 5) {
      console.log('Generated description seems invalid:', finalDescription);
      return null;
    }

    // Word count guard
    const wordCount = finalDescription.split(/\s+/).length;
    if (wordCount > 10) {
      console.warn('⚠️ Description is over 10 words:', finalDescription);
      console.warn(`   Word count: ${wordCount}`);
    }

    return finalDescription;
  } catch (error) {
    console.error('Error generating short description:', error);
    return null;
  }
}

async function updateRecipeWithShortDescription(recipeId: number, shortDescription: string): Promise<boolean> {
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

    // Update the recipe_data with the new shortDescription
    const updatedRecipeData = {
      ...currentRecipe.recipe_data,
      shortDescription: shortDescription
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
    console.error('Error in updateRecipeWithShortDescription:', error);
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

async function getAllRecipeIds(): Promise<number[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipe IDs:', error);
      return [];
    }

    return data?.map(row => row.id) || [];
  } catch (error) {
    console.error('Error in getAllRecipeIds:', error);
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

    // Check if shortDescription already exists
    if (recipe.recipe_data?.shortDescription) {
      console.log('Recipe already has shortDescription:', recipe.recipe_data.shortDescription);
      return true;
    }

    console.log('Recipe title:', recipe.recipe_data?.title || 'No title');
    console.log('Generating short description...');

    // Generate short description
    const shortDescription = await generateShortDescription(recipe.recipe_data);
    
    if (!shortDescription) {
      console.log('Failed to generate short description');
      return false;
    }

    console.log('Generated short description:', shortDescription);

    // Update the recipe
    const success = await updateRecipeWithShortDescription(recipeId, shortDescription);
    
    if (success) {
      console.log('✅ Successfully updated recipe with short description');
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
  console.log('🚀 Starting short description patch script...\n');

  // Test with one recipe
  const testRecipeIds = [651];
  
  for (const testRecipeId of testRecipeIds) {
    console.log(`🧪 Testing with recipe ID ${testRecipeId}...`);
    const testSuccess = await processSingleRecipe(testRecipeId);
    if (!testSuccess) {
      console.log(`❌ Test failed for recipe ${testRecipeId}, aborting further tests`);
      return;
    }
  }

  console.log('\n✅ Tests successful! Ready to process all recipes.');
  console.log('To process all recipes, uncomment the batch processing code below.');
  
  // Uncomment this section to process all recipes
  console.log('\n🔄 Processing all recipes...');
  
  const allRecipeIds = await getAllRecipeIds();
  console.log(`Found ${allRecipeIds.length} recipes to process`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const recipeId of allRecipeIds) {
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