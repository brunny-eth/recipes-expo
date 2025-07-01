import 'dotenv/config'
import { embedText } from '../../utils/embedText'
import { findSimilarRecipe } from '../../utils/findSimilarRecipe'

async function run() {
  const query = "chicken chili"
  const embedding = await embedText(query)

  const match = await findSimilarRecipe(embedding, 0.55)

  if (!match) {
    console.log("No recipe found.")
    return
  }
  
  const { recipe, similarity } = match

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