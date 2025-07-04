#!/usr/bin/env node

import 'dotenv/config'; // Load environment variables first
import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import { normalizeUrl } from '../utils/normalizeUrl';

/**
 * Script to update existing URL entries in processed_recipes_cache
 * with normalized URLs using the normalizeUrl function.
 * 
 * Only updates rows where source_type = 'url' (not text recipes or user-modified recipes)
 */

async function updateNormalizedUrls() {
  console.log('🚀 Starting normalized URL update script...');
  
  try {
    // Step 1: Fetch all rows that have URLs (source_type = 'url')
    console.log('📥 Fetching all URL-based recipes...');
    const { data: urlRecipes, error: fetchError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('id, url, source_type')
      .eq('source_type', 'url')
      .is('normalized_url', null); // Only get ones that haven't been normalized yet

    if (fetchError) {
      console.error('❌ Error fetching URL recipes:', fetchError);
      process.exit(1);
    }

    if (!urlRecipes || urlRecipes.length === 0) {
      console.log('✅ No URL recipes found that need normalization. All done!');
      return;
    }

    console.log(`📊 Found ${urlRecipes.length} URL recipes to normalize`);

    // Step 2: Process each URL and update the normalized_url column
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: number; url: string; error: string }> = [];

    for (const recipe of urlRecipes) {
      try {
        console.log(`🔄 Processing ID ${recipe.id}: ${recipe.url}`);
        
        // Normalize the URL using our utility function
        const normalizedUrl = normalizeUrl(recipe.url);
        
        console.log(`   📝 Normalized: ${normalizedUrl}`);
        
        // Update the database
        const { error: updateError } = await supabaseAdmin
          .from('processed_recipes_cache')
          .update({ normalized_url: normalizedUrl })
          .eq('id', recipe.id);

        if (updateError) {
          console.error(`   ❌ Error updating ID ${recipe.id}:`, updateError);
          errors.push({ id: recipe.id, url: recipe.url, error: updateError.message });
          errorCount++;
        } else {
          console.log(`   ✅ Successfully updated ID ${recipe.id}`);
          successCount++;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Error processing ID ${recipe.id}:`, errorMessage);
        errors.push({ id: recipe.id, url: recipe.url, error: errorMessage });
        errorCount++;
      }

      // Add a small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Step 3: Summary
    console.log('\n📈 Update Summary:');
    console.log(`✅ Successfully updated: ${successCount} records`);
    console.log(`❌ Errors: ${errorCount} records`);
    
    if (errors.length > 0) {
      console.log('\n❌ Error Details:');
      errors.forEach(error => {
        console.log(`   ID ${error.id} (${error.url}): ${error.error}`);
      });
    }

    // Step 4: Verify the update
    console.log('\n🔍 Verifying results...');
    const { data: verifyData, error: verifyError } = await supabaseAdmin
      .from('processed_recipes_cache')
      .select('id, url, normalized_url, source_type')
      .eq('source_type', 'url')
      .not('normalized_url', 'is', null)
      .limit(5);

    if (verifyError) {
      console.error('❌ Error verifying results:', verifyError);
    } else {
      console.log('✅ Sample of updated records:');
      verifyData?.forEach(record => {
        console.log(`   ID ${record.id}:`);
        console.log(`     Original:   ${record.url}`);
        console.log(`     Normalized: ${record.normalized_url}`);
      });
    }

    console.log('\n🎉 Script completed successfully!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateNormalizedUrls()
    .then(() => {
      console.log('✅ Process finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { updateNormalizedUrls }; 