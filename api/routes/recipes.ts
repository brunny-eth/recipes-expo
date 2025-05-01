import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import OpenAI from 'openai'

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
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    let htmlContent = '';
    let fetchError = null;

    // --- Fetch HTML Start ---
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': userAgent, /* other headers */ }
      });
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      }
      htmlContent = await response.text();
      console.log(`Successfully fetched HTML. Length: ${htmlContent.length}`);
    } catch (err) {
      console.error(`Error fetching URL ${url}:`, err);
      fetchError = err instanceof Error ? err.message : 'An unknown error occurred during fetch';
    }
    // --- Fetch HTML End ---

    if (fetchError) {
      return res.status(500).json({ error: `Failed to retrieve recipe content: ${fetchError}` });
    }

    // --- OpenAI Parsing Start ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set in environment variables.');
      return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key.' });
    }

    const openai = new OpenAI({ apiKey });

    // Rough truncation to avoid exceeding token limits (adjust limit as needed)
    const MAX_HTML_LENGTH = 100000; // Increase limit significantly for GPT-4 Turbo
    const truncatedHtml = htmlContent.length > MAX_HTML_LENGTH 
      ? htmlContent.substring(0, MAX_HTML_LENGTH) + '...'
      : htmlContent;
    
    if (htmlContent.length > MAX_HTML_LENGTH) {
      console.log(`HTML truncated from ${htmlContent.length} to ${truncatedHtml.length} characters.`);
    }

    // --- Refined Prompt for GPT-4-Turbo --- 
    const prompt = `From the following webpage HTML, extract only the recipe information. Ignore surrounding text like introductions, author notes, comments, and ads. Output ONLY valid JSON matching this exact structure: { "title": "string | null", "ingredients": "array of strings | null", "instructions": "array of strings | null", "substitutions_text": "string describing ingredient substitutions explicitly mentioned in the recipe text | null" }. If a field cannot be extracted from the text, use null for its value. Ensure the output is strictly valid JSON. HTML: ${truncatedHtml}`;
    // --- End Refined Prompt ---
    
    console.log('Sending request to OpenAI (GPT-4 Turbo with JSON mode)...');
    let parsedRecipe = null;
    let openAIError = null;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo", 
        messages: [
          { role: "system", content: "You are an assistant that extracts recipe data from HTML and outputs ONLY valid JSON matching the requested structure." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1, 
        response_format: { type: "json_object" }, // Enforce JSON output mode
      });

      // With JSON mode, the response content SHOULD be a guaranteed JSON string
      const responseContent = completion.choices[0]?.message?.content;
      console.log('OpenAI raw JSON response content:', responseContent);

      if (responseContent) {
        try {
          // Parsing should be more reliable now, but keep try-catch just in case
          parsedRecipe = JSON.parse(responseContent);
          console.log('Successfully parsed JSON from OpenAI response.');
        } catch (parseError) {
          console.error('Failed to parse JSON from OpenAI response:', parseError);
          console.error('Raw content that failed parsing:', responseContent);
          openAIError = 'Invalid JSON format received from AI parser.';
        }
      } else {
        openAIError = 'Empty response received from AI parser.';
      }

    } catch (err) {
      console.error('Error calling OpenAI API:', err);
      openAIError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI';
    }
    // --- OpenAI Parsing End ---

    if (openAIError) {
      return res.status(500).json({ error: `Failed to parse recipe using AI: ${openAIError}` });
    }

    // Send the parsed recipe data back to the app
    res.json({ 
      message: 'Recipe parsed successfully', 
      receivedUrl: url, 
      recipe: parsedRecipe // This is the structured JSON data
    }); 

  } catch (error) {
    console.error('Error in /parse route processing:', error); 
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
});

export const recipeRouter = router
