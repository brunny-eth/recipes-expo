import 'dotenv/config'
import { embedText } from '../embedText'
import { findSimilarRecipe } from '../findSimilarRecipe'

async function run() {
  const query = "chicken chili"
  const embedding = await embedText(query)

  const { recipe, similarity } = await findSimilarRecipe(embedding, 0.55)

  if (!recipe) {
    console.log("No recipe found.")
    return
  }

  // Confirm what fields exist on the matched recipe
  console.log("Similarity:", similarity)
  console.log("Matched recipe title:", recipe.title || '[none]')
  console.log("Matched recipe description:", recipe.description || '[no description]')

  if (Array.isArray(recipe.instructions)) {
    console.log("[DEBUG] Found array of instructions:")
    console.log(recipe.instructions.slice(0, 10).join('\n'))
  } else if (typeof recipe.instructionsText === 'string') {
    console.log("[DEBUG] Found instructionsText string:")
    console.log(recipe.instructionsText.slice(0, 300))
  } else {
    console.log("[DEBUG] No instructions found.")
  }
}

run().catch(console.error)