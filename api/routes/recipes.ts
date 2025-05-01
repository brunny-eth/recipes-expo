import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

const router = Router()

// Get all recipes
router.get('/', async (req: Request, res: Response) => {
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
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Get single recipe with ingredients and substitutions
router.get('/:id', async (req: Request, res: Response) => {
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
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Create new recipe
router.post('/', async (req: Request, res: Response) => {
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
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Endpoint to parse a recipe from a URL
// Revert temporary removal of async
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      // Use return to ensure the function exits after sending the response
      return res.status(400).json({ error: 'Missing URL in request body' });
    }
    // TODO: Implement actual recipe parsing logic here
    console.log(`Received URL to parse: ${url}`); 
    // For now, just acknowledge receipt
    res.json({ message: 'Parsing request received', receivedUrl: url }); 
  } catch (error) {
    console.error('Error in /parse route:', error); // Log the error server-side
    // Type check for error message access
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
});

export const recipeRouter = router
