import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { embedText } from '../embedText'
import { cosineSimilarity } from '../cosineSimilarity'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

async function run() {
  const { data: recipes } = await supabase
    .from('processed_recipes_cache')
    .select('id, recipe_data')
    .limit(20)

  if (!recipes) {
    console.error('No recipes found')
    return
  }

  const query = 'roasted chicken'
  const queryVector = await embedText(query)

  const scored = []

  for (const recipe of recipes) {
    const { title, ingredientsText } = recipe.recipe_data || {}
    const input = [
        title,
        recipe.recipe_data?.description,
        recipe.recipe_data?.ingredientsText,
        recipe.recipe_data?.instructionsText
      ].filter(Boolean).join(' ').trim()

    if (!input) continue

    const recipeVector = await embedText(input)
    const similarity = cosineSimilarity(queryVector, recipeVector)

    scored.push({
      id: recipe.id,
      title,
      similarity: similarity.toFixed(4),
    })
  }

  const topMatches = scored
    .sort((a, b) => Number(b.similarity) - Number(a.similarity))
    .slice(0, 3)

  console.log('Top 3 matches for:', query)
  console.table(topMatches)
}

run().catch(console.error)