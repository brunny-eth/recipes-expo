import { supabase } from '../lib/supabase';

export async function getAllRecipes() {
  return supabase
    .from('recipes')
    .select(`
      *,
      ingredients (*)
    `);
}

export async function getRecipeById(id: string) {
  return supabase
    .from('recipes')
    .select(`
      *,
      ingredients (
        *,
        substitutions (*)
      )
    `)
    .eq('id', id)
    .single();
} 