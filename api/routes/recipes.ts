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
      return res.status(400).json({ error: 'Missing URL in request body' });
    }

    console.log(`Attempting to fetch HTML from: ${url}`);

    // Define a common browser User-Agent
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

    let htmlContent = '';
    let fetchError = null;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', // Standard accept header
          'Accept-Language': 'en-US,en;q=0.5', // Optional: Indicate language preference
          'Referer': 'https://www.google.com/' // Optional: Sometimes helps
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch recipe: ${response.status} ${response.statusText}`);
      }

      htmlContent = await response.text();
      console.log(`Successfully fetched HTML. Length: ${htmlContent.length}`);
      // Optional: Log a snippet
      // console.log(`HTML Snippet: ${htmlContent.substring(0, 500)}...`);

    } catch (err) {
      console.error(`Error fetching URL ${url}:`, err);
      fetchError = err instanceof Error ? err.message : 'An unknown error occurred during fetch';
    }

    if (fetchError) {
      // Send error response if fetch failed
      return res.status(500).json({ error: `Failed to retrieve recipe content: ${fetchError}` });
    }
    
    // For now, just acknowledge successful HTML fetch
    // TODO: Implement actual recipe parsing logic here using htmlContent
    res.json({ 
      message: 'HTML fetched successfully', 
      receivedUrl: url, 
      htmlLength: htmlContent.length 
    }); 

  } catch (error) {
    // Catch errors related to request processing (e.g., reading req.body) rather than the external fetch
    console.error('Error in /parse route processing:', error); 
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
});

export const recipeRouter = router
