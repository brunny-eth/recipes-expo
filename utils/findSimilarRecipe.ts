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
      match_count: 5,
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

    // Filter by threshold, sort by similarity descending, and take top 3
    const filteredMatches = data
      .filter((match: any) => match.similarity >= threshold)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 3);

    if (filteredMatches.length === 0) {
      logger.info({ function: 'findSimilarRecipe', threshold }, "No matches found above threshold.");
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