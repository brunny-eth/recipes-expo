import 'dotenv/config'; // Load environment variables first
import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import { parseAndCacheRecipe } from '../server/services/parseRecipe';
import { createHash } from 'crypto';

interface RecipeCacheEntry {
  id: number;
  url: string;
  normalized_url: string;
  recipe_data: any;
  source_type: string;
  created_at: string;
  last_processed_at: string;
}

interface ReparseResult {
  recipeId: number;
  success: boolean;
  error?: string;
  originalUrl: string;
  newRecipeData?: any;
  timings?: {
    total: number;
    geminiParse: number;
  };
}

const TEST_RECIPE_IDS = [638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, 650, 651, 652, 653, 654, 655, 656, 657, 658, 659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677]; // Test on the final 40 recipes

async function getRecipeById(id: number): Promise<RecipeCacheEntry | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`Error fetching recipe ${id}:`, error);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error in getRecipeById for ${id}:`, error);
    return null;
  }
}

async function getTestRecipes(): Promise<RecipeCacheEntry[]> {
  const recipes: RecipeCacheEntry[] = [];
  
  for (const id of TEST_RECIPE_IDS) {
    const recipe = await getRecipeById(id);
    if (recipe) {
      recipes.push(recipe);
    } else {
      console.warn(`⚠️ Recipe ${id} not found, skipping`);
    }
  }
  
  return recipes;
}

async function updateRecipeInDatabase(recipeId: number, newRecipeData: any): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('processed_recipes_cache')
      .update({
        recipe_data: newRecipeData,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', recipeId);

    if (error) {
      console.error(`Error updating recipe ${recipeId}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error in updateRecipeInDatabase for ${recipeId}:`, error);
    return false;
  }
}

async function reparseSingleRecipe(recipe: RecipeCacheEntry): Promise<ReparseResult> {
  const requestId = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
  const startTime = Date.now();
  
  console.log(`\n🔄 Reparsing recipe ${recipe.id}: ${recipe.url}`);
  console.log(`   Original source type: ${recipe.source_type}`);
  console.log(`   Original title: ${recipe.recipe_data?.title || 'No title'}`);
  
  try {
    // First, delete the cache entry to force a fresh reparse
    console.log(`   🗑️ Deleting cache entry to force fresh reparse...`);
    const { error: deleteError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .delete()
      .eq('id', recipe.id);
    
    if (deleteError) {
      console.error(`❌ Failed to delete cache entry for recipe ${recipe.id}:`, deleteError);
      return {
        recipeId: recipe.id,
        success: false,
        error: `Failed to delete cache: ${deleteError.message}`,
        originalUrl: recipe.url,
        timings: {
          total: Date.now() - startTime,
          geminiParse: -1
        }
      };
    }
    
    console.log(`   ✅ Cache entry deleted, now re-parsing with Gemini 2.0 Flash...`);
    
    // Now reparse with the original URL (will be a cache miss)
    const parseResult = await parseAndCacheRecipe(recipe.url, true);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    if (parseResult.error) {
      console.error(`❌ Failed to reparse recipe ${recipe.id}:`, parseResult.error.message);
      return {
        recipeId: recipe.id,
        success: false,
        error: parseResult.error.message,
        originalUrl: recipe.url,
        timings: {
          total: totalTime,
          geminiParse: parseResult.timings.geminiParse
        }
      };
    }
    
    if (!parseResult.recipe) {
      console.error(`❌ No recipe data returned for ${recipe.id}`);
      return {
        recipeId: recipe.id,
        success: false,
        error: 'No recipe data returned from parser',
        originalUrl: recipe.url,
        timings: {
          total: totalTime,
          geminiParse: parseResult.timings.geminiParse
        }
      };
    }
    
    // Update the database with the new recipe data
    const updateSuccess = await updateRecipeInDatabase(recipe.id, parseResult.recipe);
    
    if (!updateSuccess) {
      console.error(`❌ Failed to update database for recipe ${recipe.id}`);
      return {
        recipeId: recipe.id,
        success: false,
        error: 'Failed to update database',
        originalUrl: recipe.url,
        newRecipeData: parseResult.recipe,
        timings: {
          total: totalTime,
          geminiParse: parseResult.timings.geminiParse
        }
      };
    }
    
    // Log the improvements
    console.log(`✅ Successfully reparsed recipe ${recipe.id}`);
    console.log(`   New title: ${parseResult.recipe.title || 'No title'}`);
    console.log(`   Instructions: ${parseResult.recipe.instructions?.length || 0} steps`);
    console.log(`   Tips: ${parseResult.recipe.tips ? '✅ Extracted' : '❌ None'}`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Gemini parse time: ${parseResult.timings.geminiParse}ms`);
    
    // Log instruction length improvements
    if (parseResult.recipe.instructions) {
      const avgLength = parseResult.recipe.instructions.reduce((sum: number, inst: string) => sum + inst.length, 0) / parseResult.recipe.instructions.length;
      console.log(`   Average instruction length: ${Math.round(avgLength)} characters`);
      
      // Check for long instructions
      const longInstructions = parseResult.recipe.instructions.filter((inst: string) => inst.length > 200);
      if (longInstructions.length > 0) {
        console.warn(`   ⚠️ ${longInstructions.length} instructions are still quite long (>200 chars)`);
      }
    }
    
    return {
      recipeId: recipe.id,
      success: true,
      originalUrl: recipe.url,
      newRecipeData: parseResult.recipe,
      timings: {
        total: totalTime,
        geminiParse: parseResult.timings.geminiParse
      }
    };
    
  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ Exception during reparse of recipe ${recipe.id}:`, error);
    return {
      recipeId: recipe.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      originalUrl: recipe.url,
      timings: {
        total: endTime - startTime,
        geminiParse: -1
      }
    };
  }
}

async function main() {
  console.log('🚀 Starting recipe reparse migration with Gemini 2.0 Flash');
  console.log(`📋 Testing on ${TEST_RECIPE_IDS.length} recipes: ${TEST_RECIPE_IDS.join(', ')}`);
  console.log('⏰ Started at:', new Date().toISOString());
  
  try {
    // Get the test recipes
    const recipes = await getTestRecipes();
    
    if (recipes.length === 0) {
      console.error('❌ No recipes found to reparse');
      return;
    }
    
    console.log(`📊 Found ${recipes.length} recipes to reparse`);
    
    const results: ReparseResult[] = [];
    let successCount = 0;
    let totalTime = 0;
    let totalGeminiTime = 0;
    
    // Process each recipe
    for (const recipe of recipes) {
      const result = await reparseSingleRecipe(recipe);
      results.push(result);
      
      if (result.success) {
        successCount++;
        totalTime += result.timings?.total || 0;
        totalGeminiTime += result.timings?.geminiParse || 0;
      }
      
      // Add a small delay between requests to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n📈 REPARSE SUMMARY');
    console.log('==================');
    console.log(`Total recipes processed: ${recipes.length}`);
    console.log(`Successful reparses: ${successCount}`);
    console.log(`Failed reparses: ${recipes.length - successCount}`);
    console.log(`Success rate: ${((successCount / recipes.length) * 100).toFixed(1)}%`);
    console.log(`Total processing time: ${totalTime}ms`);
    console.log(`Total Gemini API time: ${totalGeminiTime}ms`);
    console.log(`Average time per recipe: ${Math.round(totalTime / recipes.length)}ms`);
    
    // Show failures
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n❌ FAILURES:');
      failures.forEach(failure => {
        console.log(`   Recipe ${failure.recipeId}: ${failure.error}`);
      });
    }
    
    // Show improvements
    const successes = results.filter(r => r.success);
    if (successes.length > 0) {
      console.log('\n✅ IMPROVEMENTS:');
      successes.forEach(success => {
        const recipe = success.newRecipeData;
        const tipsStatus = recipe.tips ? '✅ Tips extracted' : '❌ No tips';
        const instructionCount = recipe.instructions?.length || 0;
        console.log(`   Recipe ${success.recipeId}: ${instructionCount} instructions, ${tipsStatus}`);
      });
    }
    
    console.log('\n⏰ Finished at:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Fatal error in main:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎉 Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
} 