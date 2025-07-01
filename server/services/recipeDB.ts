import { supabase } from '../lib/supabase';

export async function getAllRecipes() {
  const { data, error } = await supabase
    .from('processed_recipes_cache')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }
  return { data, error: null };
}

export async function getRecipeById(id: string) {
  return supabase
    .from('processed_recipes_cache')
    .select('*')
    .eq('id', id)
    .single();
}