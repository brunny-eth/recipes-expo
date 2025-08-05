import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import logger from '../server/lib/logger';
import { CombinedParsedRecipe } from '../common/types';

export async function findSimilarRecipe(
  embedding: number[],
  threshold = 0.50
): Promise<{ recipe: CombinedParsedRecipe; similarity: number }[] | null> {
  try {
    if (!embedding || embedding.length === 0) {
      logger.warn({ function: 'findSimilarRecipe' }, "findSimilarRecipe called with an empty or null embedding.");
      return null;
    }

    // The pgvector type requires a string representation of the array, e.g., "[0.1,0.2,...]"
    const vectorString = `[${embedding.join(',')}]`;

    logger.debug({
      function: 'findSimilarRecipe',
      queryEmbeddingLength: embedding.length,
      threshold,
      requestedMatchCount: 5
    }, "Calling RPC with increased match_count.");

    const { data, error } = await supabaseAdmin.rpc('match_recipes_by_embedding', {
      query_embedding: vectorString,
      match_threshold: threshold,
      match_count: 15, // Increased from 10 to get more potential matches for filtering
    });

    if (error) {
      logger.error({
        function: 'findSimilarRecipe',
        error: error.message,
        details: error.details,
      }, "Supabase RPC 'match_recipes_by_embedding' failed.");
      return null; 
    }

    logger.debug({ function: 'findSimilarRecipe', rawRpcData: data }, "Raw data from RPC.");

    if (!data || data.length === 0) {
      logger.info({ function: 'findSimilarRecipe' }, "No similar recipes found from RPC call.");
      return null;
    }

    // Filter out unwanted recipe types and keep only URL or video sources
    const allowedSourceTypes = ['url', 'video'];
    const excludedSourceTypes = ['user_modified', 'raw_text'];

    const filteredMatches = data
      .filter((match: any) => {
        // If the RPC returned a source_type column, use it; otherwise, fall back to inspecting the JSON if available
        const sourceType = match.source_type || match.recipe_data?.source_type || null;

        // Explicitly exclude user_modified and other unwanted source types
        if (sourceType && excludedSourceTypes.includes(sourceType)) {
          logger.debug({ function: 'findSimilarRecipe', matchId: match.id, sourceType }, 'Excluding recipe due to source type.');
          return false;
        }

        // If we can determine the source type, enforce the whitelist
        if (sourceType) {
          return allowedSourceTypes.includes(sourceType);
        }

        // If sourceType is missing, include by default (conservative) – but log for visibility
        logger.warn({ function: 'findSimilarRecipe', matchId: match.id, note: 'source_type missing, including match by default' }, 'RPC result is missing source_type field.');
        return true;
      })
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 8); // Increased from 3 to show more recipe options

    if (filteredMatches.length === 0) {
      logger.info({ function: 'findSimilarRecipe', threshold }, "No matches found after filtering.");
      return null;
    }

    // Transform the matches to include the flattened recipe data
    const finalMatches = filteredMatches.map((match: any) => {
      const flatRecipe = match.recipe_data
        ? { ...match.recipe_data, id: match.id ?? match.recipe_id }
        : null;

      return {
        recipe: flatRecipe,
        similarity: match.similarity,
      };
    }).filter((match: any) => match.recipe !== null); // Remove any matches with null recipe data

    logger.info({ 
      function: 'findSimilarRecipe', 
      foundMatchesCount: finalMatches.length, 
      topSimilarity: finalMatches[0]?.similarity,
      thresholdUsed: threshold 
    }, "Returning final similar recipes array.");

    return finalMatches.length > 0 ? finalMatches : null;
  } catch (e: any) {
    logger.error({
        function: 'findSimilarRecipe',
        error: e.message,
        stack: e.stack,
    }, "An unexpected error occurred in findSimilarRecipe.");
    return null;
  }
}