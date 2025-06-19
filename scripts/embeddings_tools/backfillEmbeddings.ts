import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { embedText } from '../embedText'
import { buildEmbeddingInput } from './embedInputBuilder'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: recipes, error } = await supabase
    .from('processed_recipes_cache')
    .select('id, recipe_data')
    .is('embedding', null) // Only backfill missing ones
    .not('id', 'is', null)
    .limit(100)

  if (error || !recipes || recipes.length === 0) {
    console.error('No recipes to backfill or query error:', error)
    return
  }

  for (const recipe of recipes) {
    const { id, recipe_data } = recipe

    const input = buildEmbeddingInput({ ...recipe_data, id })

    if (!input || input.length < 20) {
      console.log(`[SKIP] Recipe ${id} — too little content:`, input?.slice(0, 80))
      continue
    }

    try {
      const embedding = await embedText(input)

      const { error: updateError } = await supabase
        .from('processed_recipes_cache')
        .update({ embedding })
        .eq('id', id)

      if (updateError) {
        console.error(`[FAIL] Recipe ${id} — update error:`, updateError)
      } else {
        console.log(`[OK] Recipe ${id} embedded`)
      }

      await new Promise((r) => setTimeout(r, 200)) // 5/sec throttle

    } catch (err) {
      console.error(`[ERROR] Recipe ${id} — embedding error:`, err)
    }
  }

  console.log('✅ Backfill complete')
}

run().catch(console.error)