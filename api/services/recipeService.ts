import { supabase } from '../lib/supabase';

export async function createRecipeWithIngredients({ title, servings, ingredients }: { title: string; servings: number; ingredients: any[] }): Promise<{ result: any; error: string | null }> {
    try {
        const { data: recipe, error: recipeError } = await supabase
            .from('recipes')
            .insert({ title, servings })
            .select()
            .single();

        if (recipeError) throw recipeError;

        if (ingredients && ingredients.length > 0) {
            const ingredientsWithRecipeId = ingredients.map((ing: any) => ({
                ...ing,
                recipe_id: recipe.id
            }));

            const { error: ingredientsError } = await supabase
                .from('ingredients')
                .insert(ingredientsWithRecipeId);

            if (ingredientsError) throw ingredientsError;
        }

        return { result: recipe, error: null };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        return { result: null, error: message };
    }
} 