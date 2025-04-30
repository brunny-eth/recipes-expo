import { Router } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// Get all recipes
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients (*)
      `)
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get single recipe with ingredients and substitutions
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        ingredients (
          *,
          substitutions (*)
        )
      `)
      .eq('id', id)
      .single()
    
    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Create new recipe
router.post('/', async (req, res) => {
  try {
    const { title, servings, ingredients } = req.body
    
    // Insert recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({ title, servings })
      .select()
      .single()
    
    if (recipeError) throw recipeError
    
    // Insert ingredients if provided
    if (ingredients && ingredients.length > 0) {
      const ingredientsWithRecipeId = ingredients.map((ing: any) => ({
        ...ing,
        recipe_id: recipe.id
      }))
      
      const { error: ingredientsError } = await supabase
        .from('ingredients')
        .insert(ingredientsWithRecipeId)
      
      if (ingredientsError) throw ingredientsError
    }
    
    res.json(recipe)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export const recipeRouter = router
