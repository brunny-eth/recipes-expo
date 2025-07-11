import { embedText } from './embedText';
import { supabase } from '../server/lib/supabase'; 
import logger from '../server/lib/logger';

/**
 * Embeds a recipe and stores it in processed_recipes_cache.
 */
export const generateAndSaveEmbedding = async (
  recipeId: number,
  recipe: {
    title?: string | null;
    ingredientsText?: string | null;
    instructionsText?: string | null;
  }
): Promise<void> => {
  try {
    logger.info({ recipeId }, '[Embedding] Starting embedding generation...');
    const { title = '', ingredientsText = '', instructionsText = '' } = recipe;
    const embeddingInput = `${title}\n\n${ingredientsText}\n\n${instructionsText}`.trim();

    // Add detailed logging to see the exact input
    logger.info({ recipeId, embeddingInputSize: embeddingInput.length, embeddingInputPreview: embeddingInput.substring(0, 500) + '...' }, '[Embedding] Generated embedding input text.');

    const embedding = await embedText(embeddingInput);
    if (!embedding) {
      // Upgraded from warn to error and added embeddingInput for debugging
      logger.error({ recipeId, embeddingInput }, 'Failed to generate embedding. The embedText function returned a null or empty value.');
      return;
    }

    const { error } = await supabase
      .from('processed_recipes_cache')
      .update({ embedding })
      .eq('id', recipeId);

    if (error) {
      logger.error({ recipeId, error }, 'Failed to update recipe with embedding');
    } else {
      logger.info({ recipeId }, 'Successfully stored embedding');
    }
  } catch (err) {
    logger.error({ recipeId, err }, 'Error generating and storing embedding');
  }
};