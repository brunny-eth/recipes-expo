import { embedText } from './embedText';
import { supabase } from '../api/lib/supabase'; // or wherever your client lives
import logger from '../api/lib/logger';

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
    const { title = '', ingredientsText = '', instructionsText = '' } = recipe;
    const embeddingInput = `${title}\n\n${ingredientsText}\n\n${instructionsText}`.trim();

    const embedding = await embedText(embeddingInput);
    if (!embedding) {
      logger.warn({ recipeId }, 'Failed to generate embedding');
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