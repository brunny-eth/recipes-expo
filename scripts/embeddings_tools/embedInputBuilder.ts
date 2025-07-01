export function buildEmbeddingInput(recipe: any): string {
    const title = recipe?.title ?? ''
    const description = recipe?.description ?? ''
  
    // Handle both old format (ingredients) and new format (ingredientGroups)
    let ingredients = '';
    if (Array.isArray(recipe?.ingredientGroups)) {
      // New format with ingredient groups
      ingredients = recipe.ingredientGroups
        .map((group: any) => {
          if (!Array.isArray(group.ingredients)) return '';
          const groupIngredients = group.ingredients.map((i: any) => {
            const parts = [i.amount, i.unit, i.name, i.preparation].filter(Boolean)
            return parts.join(' ')
          }).join('; ')
          return groupIngredients ? `${group.name}: ${groupIngredients}` : ''
        })
        .filter(Boolean)
        .join('; ')
    } else if (Array.isArray(recipe?.ingredients)) {
      // Legacy format with flat ingredients array
      ingredients = recipe.ingredients.map((i: any) => {
        const parts = [i.amount, i.unit, i.name, i.preparation].filter(Boolean)
        return parts.join(' ')
      }).join('; ')
    }
  
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