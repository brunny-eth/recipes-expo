import { supabase } from './supabaseClient';

/**
 * Result of saving a recipe operation.
 */
export type SaveRecipeResult = {
  success: boolean;
  alreadySaved?: boolean;
  moved?: boolean;
};

/**
 * Saves a recipe for the current user to a specific folder.
 * @param recipeId The ID of the recipe to save.
 * @param folderId The ID of the folder to save the recipe to.
 * @returns {Promise<SaveRecipeResult>} Result indicating success, if already saved, or if moved.
 */
export async function saveRecipe(recipeId: number, folderId: number): Promise<SaveRecipeResult> {
  console.log("Attempting to save recipe:", recipeId, "to folder:", folderId);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("No user session found. Cannot save recipe.");
    return { success: false };
  }
  const user = session.user;

  // First, check if the recipe is already saved to avoid duplicates
  const { data: existing, error: checkError } = await supabase
    .from('user_saved_recipes')
    .select('base_recipe_id, folder_id')
    .eq('user_id', user.id)
    .eq('base_recipe_id', recipeId)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking if recipe is saved:", checkError);
    return { success: false };
  }

  if (existing) {
    // If recipe is already saved, check if it's in a different folder
    if (existing.folder_id === folderId) {
      console.log("Recipe", recipeId, "is already saved in folder", folderId);
      return { success: false, alreadySaved: true };
    } else {
      // Move recipe to the new folder
      console.log("Moving recipe", recipeId, "from folder", existing.folder_id, "to folder", folderId);
      const { error: updateError } = await supabase
        .from('user_saved_recipes')
        .update({ folder_id: folderId })
        .eq('user_id', user.id)
        .eq('base_recipe_id', recipeId);

      if (updateError) {
        console.error("Error moving recipe to folder:", updateError);
        return { success: false };
      }

      console.log("Successfully moved recipe", recipeId, "to folder", folderId);
      return { success: true, moved: true };
    }
  }

  // Verify the folder exists and belongs to the user
  const { data: folder, error: folderError } = await supabase
    .from('user_saved_folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', folderId)
    .single();

  if (folderError || !folder) {
    console.error("Error verifying folder or folder doesn't exist:", folderError);
    return { success: false };
  }

  // Fetch original recipe data for storage
  const { data: originalRecipe, error: originalRecipeError } = await supabase
    .from('processed_recipes_cache')
    .select('recipe_data')
    .eq('id', recipeId)
    .single();

  if (originalRecipeError || !originalRecipe) {
    console.error("Error fetching original recipe data:", originalRecipeError);
    return { success: false };
  }

  // If not saved, insert a new record
  const { error: insertError } = await supabase
    .from('user_saved_recipes')
    .insert({ 
      user_id: user.id, 
      base_recipe_id: recipeId,
      folder_id: folderId,
      original_recipe_data: originalRecipe.recipe_data
    });

  if (insertError) {
    console.error("Error saving recipe:", insertError);
    return { success: false };
  }

  console.log("Successfully saved recipe:", recipeId, "to folder:", folderId, "for user:", user.id);
  return { success: true };
}

/**
 * Unsaves a recipe for the current user.
 * @param recipeId The ID of the recipe to unsave.
 * @returns {Promise<boolean>} True if the recipe was unsaved successfully, false otherwise.
 */
export async function unsaveRecipe(recipeId: number): Promise<boolean> {
  console.log("Attempting to unsave recipe:", recipeId);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("No user session found. Cannot unsave recipe.");
    return false;
  }
  const user = session.user;

  const { error } = await supabase
    .from('user_saved_recipes')
    .delete()
    .match({ user_id: user.id, base_recipe_id: recipeId });

  if (error) {
    console.error("Error unsaving recipe:", error);
    return false;
  }

  console.log("Successfully unsaved recipe:", recipeId, "for user:", user.id);
  return true;
}

/**
 * Checks if a recipe is saved by the current user.
 * @param recipeId The ID of the recipe to check.
 * @returns {Promise<boolean>} True if the recipe is saved, false otherwise.
 */
export async function isRecipeSaved(recipeId: number): Promise<boolean> {
  console.log("Attempting to check if recipe is saved:", recipeId);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("No user session found. Cannot check if recipe is saved.");
    // In this specific case, if there's no user, the recipe can't be saved for them.
    return false;
  }
  const user = session.user;

  const { data, error } = await supabase
    .from('user_saved_recipes')
    .select('base_recipe_id')
    .eq('user_id', user.id)
    .eq('base_recipe_id', recipeId)
    .maybeSingle();

  if (error) {
    console.error("Error checking if recipe is saved:", error);
    return false;
  }

  if (data) {
    console.log("Recipe", recipeId, "is saved.");
    return true;
  } else {
    console.log("Recipe", recipeId, "is not saved.");
    return false;
  }
}

/**
 * Moves multiple recipes to a specific folder.
 * @param recipeIds Array of recipe IDs to move.
 * @param targetFolderId The ID of the folder to move recipes to.
 * @returns {Promise<boolean>} True if all recipes were moved successfully.
 */
export async function moveRecipesToFolder(recipeIds: number[], targetFolderId: number): Promise<boolean> {
  console.log("Attempting to move recipes:", recipeIds, "to folder:", targetFolderId);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("No user session found. Cannot move recipes.");
    return false;
  }
  const user = session.user;

  // Verify the target folder exists and belongs to the user
  const { data: folder, error: folderError } = await supabase
    .from('user_saved_folders')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', targetFolderId)
    .single();

  if (folderError || !folder) {
    console.error("Error verifying target folder or folder doesn't exist:", folderError);
    return false;
  }

  // Update all recipes to the new folder
  const { error: updateError } = await supabase
    .from('user_saved_recipes')
    .update({ folder_id: targetFolderId })
    .eq('user_id', user.id)
    .in('base_recipe_id', recipeIds);

  if (updateError) {
    console.error("Error moving recipes to folder:", updateError);
    return false;
  }

  console.log("Successfully moved", recipeIds.length, "recipes to folder:", targetFolderId);
  return true;
} 

/**
 * Removes multiple recipes from the current user's saved list.
 * @param recipeIds Array of base recipe IDs to remove from saved.
 * @returns {Promise<boolean>} True if the operation succeeded.
 */
export async function unsaveRecipes(recipeIds: number[]): Promise<boolean> {
  console.log("Attempting to bulk unsave recipes:", recipeIds);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("No user session found. Cannot bulk unsave recipes.");
    return false;
  }
  const user = session.user;

  if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
    return true; // nothing to do
  }

  const { error } = await supabase
    .from('user_saved_recipes')
    .delete()
    .eq('user_id', user.id)
    .in('base_recipe_id', recipeIds);

  if (error) {
    console.error("Error bulk unsaving recipes:", error);
    return false;
  }

  console.log("Successfully unsaved", recipeIds.length, "recipes for user:", user.id);
  return true;
}