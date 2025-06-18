import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function findSimilarRecipe(
  embedding: number[],
  threshold = 0.55
): Promise<{ recipe: any | null; similarity: number }> {
  const { data, error } = await supabase.rpc('match_recipes_by_embedding', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 1,
  })

  if (error) throw new Error(`RPC error: ${error.message}`)

  if (!data || data.length === 0) return { recipe: null, similarity: 0 }

  const match = data[0]

  console.log('[DEBUG] Raw match from RPC:', JSON.stringify(match, null, 2))

  // Flatten recipe_data if it exists
  const flatRecipe = match.recipe_data
    ? { ...match.recipe_data, id: match.id ?? match.recipe_id }
    : null

  return {
    recipe: flatRecipe,
    similarity: match.similarity,
  }
}