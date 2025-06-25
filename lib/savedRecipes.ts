import { supabase } from './supabaseClient';

/**
 * Saves a recipe for the current user.
 * @param recipeId The ID of the recipe to save.
 * @returns {Promise<boolean>} True if the recipe was saved successfully or was already saved, false otherwise.
 */
export async function saveRecipe(recipeId: number): Promise<boolean> {
  console.log("Attempting to save recipe:", recipeId);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    console.error("No user session found. Cannot save recipe.");
    return false;
  }
  const user = session.user;

  // First, check if the recipe is already saved to avoid duplicates
  const { data: existing, error: checkError } = await supabase
    .from('user_saved_recipes')
    .select('base_recipe_id')
    .eq('user_id', user.id)
    .eq('base_recipe_id', recipeId)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking if recipe is saved:", checkError);
    return false;
  }

  if (existing) {
    console.log("Recipe", recipeId, "is already saved for user", user.id);
    return true;
  }

  // If not saved, insert a new record
  const { error: insertError } = await supabase
    .from('user_saved_recipes')
    .insert({ user_id: user.id, base_recipe_id: recipeId });

  if (insertError) {
    console.error("Error saving recipe:", insertError);
    return false;
  }

  console.log("Successfully saved recipe:", recipeId, "for user:", user.id);
  return true;
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