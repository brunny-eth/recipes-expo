export function buildEmbeddingInput(recipe: any): string {
    const title = recipe?.title ?? ''
    const description = recipe?.description ?? ''
  
    const ingredients = Array.isArray(recipe?.ingredients)
      ? recipe.ingredients.map((i: any) => {
          const parts = [i.amount, i.unit, i.name, i.preparation].filter(Boolean)
          return parts.join(' ')
        }).join('; ')
      : ''
  
    const instructions = Array.isArray(recipe?.instructions)
      ? recipe.instructions.join(' ')
      : (recipe?.instructionsText ?? '')
  
    return [
      `Title: ${title}`,
      description ? `Description: ${description}` : '',
      ingredients ? `Ingredients: ${ingredients}` : '',
      instructions ? `Instructions: ${instructions}` : ''
    ]
      .filter(Boolean)
      .join(' ')
      .trim()
  }