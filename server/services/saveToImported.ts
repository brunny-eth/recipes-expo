import { supabaseAdmin } from '../lib/supabaseAdmin';
import logger from '../lib/logger';

/**
 * Saves a recipe to the user's "Imported" folder (system folder with is_system=true)
 * @param userId - The user ID (string)
 * @param recipeId - The recipe ID (number)
 * @returns Promise<void> - Never throws, logs errors instead
 */
export async function saveToImported(userId: string | undefined, recipeId: number): Promise<void> {
  // Skip if no userId provided (guest parses)
  if (!userId) {
    logger.info({ recipeId }, '[saveToImported] Skipping save - no userId provided (guest parse)');
    return;
  }

  try {
    logger.info({ userId, recipeId }, '[saveToImported] Starting save to imported folder');

    // Query user_saved_folders for is_system=true for this user
    const { data: systemFolder, error: folderError } = await supabaseAdmin
      .from('user_saved_folders')
      .select('id')
      .eq('user_id', userId)
      .eq('is_system', true)
      .single();

    if (folderError) {
      logger.error({ userId, recipeId, error: folderError }, '[saveToImported] Failed to find system folder');
      return;
    }

    if (!systemFolder) {
      logger.warn({ userId, recipeId }, '[saveToImported] No system folder found for user');
      return;
    }

    const folderId = systemFolder.id;
    logger.info({ userId, recipeId, folderId }, '[saveToImported] Found system folder, inserting recipe');

    // Insert into user_saved_recipes
    const { error: insertError } = await supabaseAdmin
      .from('user_saved_recipes')
      .insert({
        user_id: userId,
        base_recipe_id: recipeId,
        folder_id: folderId,
      });

    if (insertError) {
      logger.error({ userId, recipeId, folderId, error: insertError }, '[saveToImported] Failed to insert recipe into user_saved_recipes');
      return;
    }

    logger.info({ userId, recipeId, folderId }, '[saveToImported] Successfully saved recipe to imported folder');

  } catch (error) {
    // Never throw - just log the error
    logger.error({ userId, recipeId, error }, '[saveToImported] Unexpected error occurred');
  }
}
