import { supabaseAdmin } from '../server/lib/supabaseAdmin';
import logger from '../server/lib/logger';

export async function findSimilarRecipe(
  embedding: number[],
  threshold = 0.55
): Promise<{ recipe: any | null; similarity: number } | null> {
  try {
    if (!embedding || embedding.length === 0) {
      logger.warn({ function: 'findSimilarRecipe' }, "findSimilarRecipe called with an empty or null embedding.");
      return null;
    }

    // The pgvector type requires a string representation of the array, e.g., "[0.1,0.2,...]"
    const vectorString = `[${embedding.join(',')}]`;

    logger.debug({
      function: 'findSimilarRecipe',
      embeddingLength: embedding.length, // Your DB vector column should match this dimension (e.g., vector(1536))
      threshold,
    }, "Executing RPC 'match_recipes_by_embedding'");

    const { data, error } = await supabaseAdmin.rpc('match_recipes_by_embedding', {
      query_embedding: vectorString,
      match_threshold: threshold,
      match_count: 1,
    });

    if (error) {
      logger.error({
        function: 'findSimilarRecipe',
        error: error.message,
        details: error.details,
      }, "Supabase RPC 'match_recipes_by_embedding' failed.");
      return null; 
    }

    logger.debug({ function: 'findSimilarRecipe', data }, "Raw data from RPC");

    if (!data || data.length === 0) {
      logger.info({ function: 'findSimilarRecipe' }, "No similar recipes found from RPC call.");
      return null;
    }

    const match = data[0];

    // The raw match data contains the nested recipe_data and the similarity score.
    // The recipe_data is what we want to return, flattened with its ID.
    const flatRecipe = match.recipe_data
      ? { ...match.recipe_data, id: match.id ?? match.recipe_id }
      : null;

    if (!flatRecipe) {
      logger.warn({ function: 'findSimilarRecipe', match }, "Match found but recipe_data was null or missing.");
      return null;
    }

    return {
      recipe: flatRecipe,
      similarity: match.similarity,
    };
  } catch (e: any) {
    logger.error({
        function: 'findSimilarRecipe',
        error: e.message,
        stack: e.stack,
    }, "An unexpected error occurred in findSimilarRecipe.");
    return null;
  }
}