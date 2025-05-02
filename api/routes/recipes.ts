import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
import OpenAI from 'openai'

// --- Define the expected structured ingredient type ---
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
};
// --- ---

// --- Define the type for the first parsing pass ---
type InitialParsedRecipe = {
  title: string | null;
  ingredients: string[] | null; // Expect strings first
  instructions: string[] | null;
  substitutions_text: string | null;
};
// --- ---

// --- Define the type for the final response ---
type FinalRecipeOutput = {
  title: string | null;
  ingredients: StructuredIngredient[] | string[] | null; // Can be structured or fallback to strings
  instructions: string[] | null;
  substitutions_text: string | null;
};
// --- ---

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

// --- Main Parsing Route ---
router.post('/parse', async (req: Request, res: Response) => {
  // Overall try-catch for request processing errors
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL in request body' });
    }

    // --- Step 1: Fetch HTML ---
    console.log(`Attempting to fetch HTML from: ${url}`);
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    let htmlContent = '';
    let fetchError = null;
    try {
      // Added back other headers from previous version
      const response = await fetch(url, { 
        headers: { 
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', 
          'Accept-Language': 'en-US,en;q=0.5', 
          'Referer': 'https://www.google.com/' 
        } 
      });
      if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      htmlContent = await response.text();
      console.log(`Successfully fetched HTML. Length: ${htmlContent.length}`);
    } catch (err) {
      console.error(`Error fetching URL ${url}:`, err);
      fetchError = err instanceof Error ? err.message : 'An unknown error occurred during fetch';
    }
    if (fetchError) {
      return res.status(500).json({ error: `Failed to retrieve recipe content: ${fetchError}` });
    }
    // --- End Fetch HTML ---


    // --- Step 2: Initial OpenAI Parsing (GPT-4 Turbo) ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set.');
      return res.status(500).json({ error: 'Server configuration error: Missing OpenAI API key.' });
    }
    const openai = new OpenAI({ apiKey });

    const MAX_HTML_LENGTH = 100000;
    const truncatedHtml = htmlContent.length > MAX_HTML_LENGTH
      ? htmlContent.substring(0, MAX_HTML_LENGTH) + '...'
      : htmlContent;
    if (htmlContent.length > MAX_HTML_LENGTH) {
      console.log(`HTML truncated from ${htmlContent.length} to ${truncatedHtml.length} chars.`);
    }

    // --- Refined Prompt for GPT-4-Turbo (No Step Numbers) --- 
    const initialPrompt = `From the following webpage HTML, extract only the recipe information. Ignore surrounding text like introductions, author notes, comments, and ads. Output ONLY valid JSON matching this exact structure: { "title": "string | null", "ingredients": "array of strings | null", "instructions": "array of strings, where each string is a single step without any numbering | null", "substitutions_text": "string describing ingredient substitutions explicitly mentioned in the recipe text | null" }. If a field cannot be extracted from the text, use null for its value. Ensure the output is strictly valid JSON. HTML: ${truncatedHtml}`;
    // --- End Refined Prompt ---

    console.log('Sending initial request to OpenAI (GPT-4 Turbo with JSON mode)...');
    let initialParsedResult: InitialParsedRecipe | null = null;
    let initialOpenAIError = null;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: "You are an assistant that extracts recipe data from HTML and outputs ONLY valid JSON matching the requested structure." },
          { role: "user", content: initialPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content;
      console.log('OpenAI (Pass 1) raw JSON response content:', responseContent);
      if (responseContent) {
        initialParsedResult = JSON.parse(responseContent) as InitialParsedRecipe;
        console.log('Successfully parsed initial JSON from OpenAI response.');
      } else {
        initialOpenAIError = 'Empty response received from AI parser (Pass 1).';
      }
    } catch (err) {
      console.error('Error calling OpenAI API (Pass 1):', err);
      initialOpenAIError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI (Pass 1)';
    }
     if (initialOpenAIError) {
      // If the first pass fails critically, return error
      return res.status(500).json({ error: `Failed initial recipe parse: ${initialOpenAIError}` });
    }
    if (!initialParsedResult) {
       // Should technically be caught by error above, but safety check
       return res.status(500).json({ error: 'Failed to get initial parsed data.' });
    }
    // --- End Initial OpenAI Parsing ---


    // --- Step 3: Secondary OpenAI Parsing for Ingredients (GPT-3.5 Turbo) ---
    let finalRecipeOutput: FinalRecipeOutput = { // Initialize with results from pass 1
      title: initialParsedResult.title,
      ingredients: initialParsedResult.ingredients, // Start with string array or null
      instructions: initialParsedResult.instructions,
      substitutions_text: initialParsedResult.substitutions_text,
    };

    if (initialParsedResult.ingredients && initialParsedResult.ingredients.length > 0) {
      console.log(`Found ${initialParsedResult.ingredients.length} ingredient strings to parse further.`);

      // --- Prompt asking for object containing the array --- 
      const ingredientParsingPrompt = `Parse the following array of ingredient strings into an array of JSON objects. Each object should have keys: "name" (string), "amount" (string or null), "unit" (string or null). 
      Convert all fractional amounts (e.g., "1 1/2", "3/4") to their decimal representation (e.g., "1.5", "0.75"). 
      Handle variations like ranges, optional parts. If a part isn't clearly identifiable, use null. 
      If an ingredient clearly lacks a quantity (e.g., toppings like 'fresh cilantro', 'salt', 'pepper'), set amount to null and unit to "to taste" or "as needed". 
      Output ONLY a single valid JSON object with one key "structured_ingredients" whose value is the array of parsed ingredient objects. 
      Example: { "structured_ingredients": [ { "name": "flour", "amount": "1.5", "unit": "cups" }, { "name": "salt", "amount": null, "unit": "to taste" } ] }. 
      Ingredient Strings: ${JSON.stringify(initialParsedResult.ingredients)}`;

      console.log('Sending ingredient parsing request to OpenAI (GPT-4 Turbo with JSON mode)...');
      let structuredIngredients: StructuredIngredient[] | null = null;
      let ingredientParseError = null;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4-turbo", 
          messages: [
            // Adjusted system message slightly
            { role: "system", content: "You are an assistant that parses ingredient strings and outputs a JSON object containing a 'structured_ingredients' array." },
            { role: "user", content: ingredientParsingPrompt }
          ],
          temperature: 0.1, 
          response_format: { type: "json_object" }, 
        });

        const responseContent = completion.choices[0]?.message?.content;
        console.log('OpenAI (Pass 2 - Ingredients) raw JSON response content:', responseContent);

        if (responseContent) {
           try {
             // With JSON mode, parsing should be direct
             const parsedResult: any = JSON.parse(responseContent); // Cast to any
             
             // --- Expect an object with a 'structured_ingredients' key --- 
             let parsedArray: any[] | null = null;
             if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.structured_ingredients)) {
                parsedArray = parsedResult.structured_ingredients;
             } else {
                 console.error("Parsed JSON response did not contain expected 'structured_ingredients' array:", parsedResult);
                 throw new Error("Parsed JSON result did not have the expected structure.");
             }
             // --- End structure check ---

             if(Array.isArray(parsedArray)) { // Should always be true if above check passes
                // Add validation here if needed
                structuredIngredients = parsedArray as StructuredIngredient[];
                console.log('Successfully parsed structured ingredients from OpenAI response (JSON mode).');
             } else {
                // This path should ideally not be reached due to checks above
                console.error('Extracted ingredient data was unexpectedly not an array:', parsedArray);
                throw new Error("Extracted ingredient data is not an array.");
             }
           } catch (parseErr) {
             console.error('Failed to parse structured ingredients JSON from OpenAI response (Pass 2):', parseErr);
             console.error('Raw content that failed parsing:', responseContent);
             ingredientParseError = 'Invalid JSON format received from AI ingredient parser.';
           }
        } else {
          ingredientParseError = 'Empty response received from AI ingredient parser.';
        }

      } catch (err) {
        console.error('Error calling OpenAI API (Pass 2 - Ingredients):', err);
        ingredientParseError = err instanceof Error ? err.message : 'An unknown error occurred calling OpenAI for ingredients';
      }

      if (structuredIngredients) {
         // Basic validation of structure before assigning
         if (structuredIngredients.every(ing => typeof ing === 'object' && ing !== null && 'name' in ing && 'amount' in ing && 'unit' in ing)) {
            finalRecipeOutput.ingredients = structuredIngredients; // Replace string array with structured array
         } else {
            console.warn(`Parsed ingredient array did not have the expected structure. Error: ${ingredientParseError || 'Invalid structure'}. Returning original ingredient strings.`);
            // Keep the original string array
         }
      } else {
         console.warn(`Failed to parse ingredients into structured format. Error: ${ingredientParseError || 'Unknown'}. Returning original ingredient strings.`);
         // Keep the original string array 
      }

    } else {
      console.log("No ingredients found in initial parse to process further.");
    }
    // --- End Secondary OpenAI Parsing ---


    // --- Step 4: Send Final Response ---
    console.log("Sending final parsed recipe data to client.");
    res.json({
      message: 'Recipe processing complete.', // Updated message
      receivedUrl: url,
      recipe: finalRecipeOutput // Contains structured ingredients if successful, otherwise strings
    });
    // --- End Send Final Response ---

  } catch (error) {
    // Catch errors related to request processing (e.g., reading req.body)
    console.error('Error in /parse route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    res.status(500).json({ error: message });
  }
});

export const recipeRouter = router
