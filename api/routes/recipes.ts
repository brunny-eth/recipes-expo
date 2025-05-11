import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'
// import OpenAI from 'openai'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from "@google/generative-ai"; // Import Google AI SDK
import scraperapiClient from 'scraperapi-sdk'; // Import the SDK
import { createHash } from 'crypto'; // <-- RE-ADD IMPORT for requestId
import { isProbablyUrl } from '../utils/detectUrl'; // <-- IMPORT ADDED
import { preprocessRawRecipeText } from '../utils/preprocessText'; // <-- IMPORT ADDED
import { truncateTextByLines } from '../utils/truncate'; // <-- IMPORT ADDED
import { generateCacheKeyHash } from '../utils/hash'; // <-- IMPORT ADDED
import { extractRecipeContent } from '../services/extractContent'; // <-- IMPORT ADDED
import { fetchHtmlWithFallback } from '../services/htmlFetch'; // <-- IMPORT ADDED
import { handleRawTextRecipe } from '../services/promptText'; // <-- IMPORT ADDED
import { handleRecipeUrl } from '../services/promptUrl'; // <-- IMPORT ADDED

// --- Define the expected *single pass* structured ingredient type --- 
type StructuredIngredient = {
  name: string;
  amount: string | null;
  unit: string | null;
  suggested_substitutions?: Array<{ name: string; description?: string | null, amount?: string | number | null, unit?: string | null }> | null; // Added amount/unit to substitution suggestions
};

// --- Define the type for the combined parsing pass --- 
// (This now expects structured ingredients directly)
type CombinedParsedRecipe = {
  title: string | null;
  ingredients: StructuredIngredient[] | null; // Expect structured ingredients directly
  instructions: string[] | null;
  substitutions_text: string | null;
  recipeYield?: string | null;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
  nutrition?: { calories?: string | null; protein?: string | null; [key: string]: any } | null;
};

// --- Helper Function: Fetch HTML with Fallback --- DELETED
// async function fetchHtmlWithFallback(
//   url: string, 
//   apiKey: string | undefined, 
//   client: any 
// ): Promise<{ htmlContent: string; fetchMethodUsed: string; error: Error | null }> {
// ... function body deleted ...
// }
// --- End Helper Function: Fetch HTML with Fallback ---

const router = Router()

// --- Initialize ScraperAPI Client ---
const scraperApiKey = process.env.SCRAPERAPI_KEY;
if (!scraperApiKey) {
  console.error('SCRAPERAPI_KEY environment variable is not set!');
}
const scraperClient = scraperapiClient(scraperApiKey || ''); 

// --- Initialize Google AI Client ---
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set!');
}
const genAI = new GoogleGenerativeAI(googleApiKey || '');
const geminiConfig: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.1, 
};
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
const geminiModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest",
    generationConfig: geminiConfig,
    safetySettings: safetySettings,
});

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
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// Create new recipe
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, servings, ingredients } = req.body
    
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({ title, servings })
      .select()
      .single()
    
    if (recipeError) throw recipeError
    
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
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ error: message });
  }
})

// --- MODIFIED Main Parsing Route --- 
router.post('/parse', async (req: Request, res: Response) => {
  const requestId = createHash('sha256').update(Date.now().toString() + Math.random().toString()).digest('hex').substring(0, 12);
  const requestStartTime = Date.now();
  let overallTimings = {
    dbCheck: -1,
    processing: -1, 
    dbInsert: -1,
    total: -1
  };
  let handlerUsage = { combinedParseInputTokens: 0, combinedParseOutputTokens: 0 }; 

  const { input } = req.body; 
  if (!input || typeof input !== 'string' || input.trim() === '') {
    console.warn(`[${requestId}] Invalid request: Missing or empty "input" in request body.`);
    return res.status(400).json({ error: 'Missing or empty "input" in request body' });
  }

  const trimmedInput = input.trim();
  const isUrl = isProbablyUrl(trimmedInput);
  const cacheKey = isUrl ? trimmedInput : generateCacheKeyHash(trimmedInput);

  console.log(`[${requestId}] Received parse request. Input type: ${isUrl ? 'URL' : 'Raw Text'}. Input length: ${trimmedInput.length}. Cache key: ${cacheKey}`);

  const dbCheckStartTime = Date.now();
  try {
    const { data: cachedRecipe, error: dbError } = await supabase
      .from('processed_recipes_cache') 
      .select('recipe_data') 
      .eq('url', cacheKey) 
      .maybeSingle(); 

    overallTimings.dbCheck = Date.now() - dbCheckStartTime;

    if (dbError) {
      console.error(`[${requestId}] Error checking cache in Supabase for key ${cacheKey}:`, dbError);
    }

    if (cachedRecipe && cachedRecipe.recipe_data) {
      console.log(`[${requestId}] Cache hit for key: ${cacheKey}. Returning cached data. DB Check time: ${overallTimings.dbCheck}ms.`);
      overallTimings.total = Date.now() - requestStartTime;
      return res.json({
        message: 'Recipe retrieved from cache.',
        inputType: isUrl ? 'URL' : 'Raw Text',
        receivedInput: trimmedInput, 
        cacheKey: cacheKey,
        recipe: cachedRecipe.recipe_data 
      });
    }
    console.log(`[${requestId}] Cache miss for key: ${cacheKey}. DB Check time: ${overallTimings.dbCheck}ms. Proceeding with parsing.`);
  } catch (cacheError) {
    overallTimings.dbCheck = Date.now() - dbCheckStartTime;
    console.error(`[${requestId}] Exception during cache check for key ${cacheKey}:`, cacheError);
  }

  if (!googleApiKey) { 
    console.error(`[${requestId}] Server configuration error: Missing Google API key.`);
    return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
  }

  let handlerResponse;
  if (isUrl) {
    // Call the imported function, passing the required instances/keys
    handlerResponse = await handleRecipeUrl(trimmedInput, requestId, geminiModel, scraperApiKey, scraperClient);
  } else {
    handlerResponse = await handleRawTextRecipe(trimmedInput, requestId, geminiModel);
  }

  // Correctly access timings based on the handler type
  if (isUrl) {
    overallTimings.processing = (handlerResponse.timings as { fetchHtml: number; extractContent: number; geminiCombinedParse: number; totalProcessingNoCache: number }).totalProcessingNoCache;
  } else {
    overallTimings.processing = (handlerResponse.timings as { geminiCombinedParse: number; total: number }).total;
  }
  
  if (handlerResponse.usage) { // Check if usage exists before assigning
      handlerUsage = handlerResponse.usage;
  }

  if (handlerResponse.error || !handlerResponse.recipe) {
    overallTimings.total = Date.now() - requestStartTime;
    console.error(`[${requestId}] Processing failed for input. Error: ${handlerResponse.error}. Input Type: ${isUrl ? 'URL' : 'Raw Text'}. Overall timings: DB Check=${overallTimings.dbCheck}ms, Processing=${overallTimings.processing}ms, Total=${overallTimings.total}ms`);
    return res.status(500).json({
      error: handlerResponse.error || 'Failed to process recipe input.',
      inputType: isUrl ? 'URL' : 'Raw Text',
      fetchMethodUsed: (handlerResponse as any).fetchMethodUsed, 
      receivedInput: trimmedInput,
      cacheKey: cacheKey,
    });
  }

  const finalRecipeData = handlerResponse.recipe;

  if (finalRecipeData) {
    const dbInsertStartTime = Date.now();
    try {
      const { error: insertError } = await supabase
        .from('processed_recipes_cache') 
        .insert({
          url: cacheKey, 
          recipe_data: finalRecipeData, 
        });

      overallTimings.dbInsert = Date.now() - dbInsertStartTime;

      if (insertError) {
        console.error(`[${requestId}] Error saving recipe to cache (key: ${cacheKey}):`, insertError);
      } else {
        console.log(`[${requestId}] Successfully cached new recipe (key: ${cacheKey}). DB Insert time: ${overallTimings.dbInsert}ms`);
      }
    } catch (cacheInsertError) {
      overallTimings.dbInsert = Date.now() - dbInsertStartTime; 
      console.error(`[${requestId}] Exception during cache insertion (key: ${cacheKey}):`, cacheInsertError);
    }
  }
  
  overallTimings.total = Date.now() - requestStartTime;
  console.log(`[${requestId}] Request complete for input. Input Type: ${isUrl ? 'URL' : 'Raw Text'}. Overall Timings (ms): DB Check=${overallTimings.dbCheck}, Processing=${overallTimings.processing}, DB Insert=${overallTimings.dbInsert}, Total=${overallTimings.total}`);
  if (handlerUsage) {
    console.log(`[${requestId}] Token Usage: Input=${handlerUsage.combinedParseInputTokens}, Output=${handlerUsage.combinedParseOutputTokens}. Fetch Method (if URL): ${(handlerResponse as any).fetchMethodUsed || 'N/A'}`);
  }

  res.json({
    message: `Recipe processing complete (${isUrl ? 'URL' : 'Raw Text'}).`,
    inputType: isUrl ? 'URL' : 'Raw Text',
    fetchMethodUsed: (handlerResponse as any).fetchMethodUsed,
    receivedInput: trimmedInput,
    cacheKey: cacheKey,
    recipe: finalRecipeData
  });

});

// --- Rewrite Instructions Endpoint ---
router.post('/rewrite-instructions', async (req: Request, res: Response) => {
  // TODO: Adapt this endpoint to use Gemini
  // Similar steps: Check key, create prompt, call geminiModel.generateContent, parse JSON response
  try {
    const { originalInstructions, originalIngredientName, substitutedIngredientName } = req.body; // Keep validation
    if (!originalInstructions || !Array.isArray(originalInstructions) || originalInstructions.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid original instructions' });
    }
    if (!originalIngredientName || !substitutedIngredientName) {
      return res.status(400).json({ error: 'Missing original or substituted ingredient name' });
    }

    // Check Google AI key
    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    // --- Construct the prompt for Gemini --- (Using the same logic as the previous OpenAI prompt)
    const rewritePrompt = `You are an expert cooking assistant. You are given recipe instructions and a specific ingredient substitution.
Original Ingredient: ${originalIngredientName}
Substituted Ingredient: ${substitutedIngredientName}

Your task is to rewrite the original instructions to accommodate the substituted ingredient. Consider:
- **Preparation differences:** Does the substitute need different prep (e.g., pressing tofu, soaking beans)? Add or modify steps accordingly.
- **Cooking time/temperature:** Adjust cooking times and temperatures if the substitute cooks differently.
- **Liquid adjustments:** Might the substitute absorb more or less liquid?
- **Flavor profile:** Keep the core recipe goal, but account for flavor changes if necessary (though focus primarily on process).
- **Safety:** Ensure the rewritten steps are safe and make culinary sense.

Rewrite the steps clearly. Output ONLY a valid JSON object with a single key "rewrittenInstructions", where the value is an array of strings, each string being a single step without numbering.

Original Instructions (Array):
${JSON.stringify(originalInstructions)}
`;

    console.log(`Sending rewrite request to Gemini for ${originalIngredientName} -> ${substitutedIngredientName}`);

    let rewrittenInstructions: string[] | null = null;
    let rewriteError: string | null = null;
    let rewriteInputTokens = 0;
    let rewriteOutputTokens = 0;
    let rewriteTime = -1; // Added for timing

    // --- Make the Gemini call --- 
    const rewriteStartTime = Date.now(); // Start timing
    try {
        if (rewritePrompt.length > 100000) { // Basic prompt length check
           throw new Error(`Rewrite prompt too large (${rewritePrompt.length} chars).`);
        }

        const result = await geminiModel.generateContent(rewritePrompt);
        const response = result.response;
        const responseText = response.text();

        // Log token usage
        rewriteInputTokens = response.usageMetadata?.promptTokenCount || 0;
        rewriteOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        console.log(`Gemini Rewrite Token Usage: ${rewriteInputTokens}/${rewriteOutputTokens} (Input/Output)`);

        console.log('Gemini (Rewrite) raw JSON response content:', responseText);

        if (responseText) {
            try {
                const parsedResult: any = JSON.parse(responseText);
                if (typeof parsedResult === 'object' && parsedResult !== null && Array.isArray(parsedResult.rewrittenInstructions)) {
                    rewrittenInstructions = parsedResult.rewrittenInstructions.filter((step: any) => typeof step === 'string'); // Ensure all elements are strings
                    console.log('Successfully parsed rewritten instructions from Gemini response.');
                } else {
                    console.error("Parsed JSON response did not contain expected 'rewrittenInstructions' array:", parsedResult);
                    throw new Error("Parsed JSON result did not have the expected structure.");
                }
            } catch (parseErr) {
                console.error('Failed to parse rewritten instructions JSON from Gemini response:', parseErr);
                console.error('Raw content that failed parsing:', responseText);
                rewriteError = 'Invalid JSON format received from AI instruction rewriter.';
            }
        } else {
            rewriteError = 'Empty response received from AI instruction rewriter.';
        }

    } catch (err) {
       rewriteError = err instanceof Error ? err.message : 'Unknown Gemini rewrite error';
       console.error('Gemini rewrite API call error:', err);
       // Handle safety blocks
       if ((err as any)?.response?.promptFeedback?.blockReason) {
           rewriteError = `Gemini blocked the prompt/response due to safety settings: ${ (err as any).response.promptFeedback.blockReason }`;
       }
    } finally {
        rewriteTime = Date.now() - rewriteStartTime; // End timing
        console.log(`Gemini Rewrite Time: ${rewriteTime}ms`); // Log time
    }

    // --- Send response or error ---
    if (rewriteError || !rewrittenInstructions) {
      console.error(`Failed to rewrite instructions with Gemini: ${rewriteError || 'Result was null'}`);
      return res.status(500).json({ error: `Failed to rewrite instructions: ${rewriteError || 'Unknown error'}` });
    } else {
        res.json({ rewrittenInstructions });
    }

  } catch (error) {
    console.error('Error in /rewrite-instructions route processing:', error);
    const message = error instanceof Error ? error.message : 'An unknown server error occurred';
    res.status(500).json({ error: message });
  }
});

// --- Scale Instructions Endpoint ---
router.post('/scale-instructions', async (req: Request, res: Response) => {
  // TODO: Adapt this endpoint to use Gemini
   // Similar steps: Check key, create prompt, call geminiModel.generateContent, parse JSON response
   try {
     const { instructionsToScale, originalIngredients, scaledIngredients } = req.body; // Keep validation
     if (!Array.isArray(instructionsToScale) || !Array.isArray(originalIngredients) || !Array.isArray(scaledIngredients)) {
      return res.status(400).json({ error: 'Invalid input: instructions, originalIngredients, and scaledIngredients must be arrays.' });
     }
     // Add other input checks as before...
     if (instructionsToScale.length === 0) {
        console.log("No instructions provided to scale.");
        return res.json({ scaledInstructions: [] }); // Return empty if no instructions
     }
     if (originalIngredients.length !== scaledIngredients.length) {
        console.warn("Original and scaled ingredient lists have different lengths. Scaling might be inaccurate.");
     }

     // Check Google AI key
    if (!googleApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google API key.' });
    }

    // --- Construct the prompt for Gemini --- (Using the same logic as before)
    const originalIngredientsDesc = originalIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');
    const scaledIngredientsDesc = scaledIngredients.map((ing: any) => `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()).join(', ');

    const scalePrompt = `You are an expert recipe editor. You are given recipe instructions that were originally written for ingredients with these quantities: [${originalIngredientsDesc}].

The ingredients have now been scaled to new quantities: [${scaledIngredientsDesc}].

Your task is to rewrite the provided recipe instructions, carefully adjusting any specific ingredient quantities mentioned in the text to match the *new* scaled quantities. Maintain the original meaning, structure, and step count. Be precise with the numbers.

**Important Scaling Rules for Quantities:**
- For most ingredients, use the precise scaled quantity.
- However, for ingredients that are typically used whole and are not easily divisible (e.g., star anise, whole cloves, cinnamon sticks, bay leaves, an egg), if the scaled quantity results in a fraction, round it to the nearest sensible whole number. For example, if scaling results in "1 1/2 star anise", use "2 star anise" or "1 star anise" based on which is closer or makes more culinary sense. If it's "0.25 of an egg", consider if it should be omitted or rounded to 1 if critical, or if the instruction should note to use "a small amount of beaten egg". Use your culinary judgment for sensible rounding of such items.

For example, if an original instruction was "Add 2 cups flour" and the scaled ingredients now list "4 cups flour", the instruction should become "Add 4 cups flour". If an instruction mentions "the onion" and the quantity didn't change or wasn't numeric, leave it as is. Only adjust explicit numeric quantities that correspond to scaled ingredients.

Output ONLY a valid JSON object with a single key "scaledInstructions", where the value is an array of strings, each string being a single rewritten step.

Instructions to Scale (Array):
${JSON.stringify(instructionsToScale)}
`;

    console.log('Sending instruction scaling request to Gemini...');

    let scaledInstructionsResult: string[] | null = null;
    let scaleError: string | null = null;
    let scaleInputTokens = 0;
    let scaleOutputTokens = 0;
    let scaleTime = -1; // Added for timing

    // --- Make the Gemini call --- 
    const scaleStartTime = Date.now(); // Start timing
    try {
        if (scalePrompt.length > 100000) { // Basic prompt length check
           throw new Error(`Scale prompt too large (${scalePrompt.length} chars).`);
        }

       const result = await geminiModel.generateContent(scalePrompt);
       const response = result.response;
       const responseText = response.text();

       // Log token usage
       scaleInputTokens = response.usageMetadata?.promptTokenCount || 0;
       scaleOutputTokens = response.usageMetadata?.candidatesTokenCount || 0;
       console.log(`Gemini Scale Token Usage: ${scaleInputTokens}/${scaleOutputTokens} (Input/Output)`);

       console.log('Gemini (Scale) raw JSON response content:', responseText);

       if (responseText) {
           try {
             const parsedResult: any = JSON.parse(responseText);
             if (parsedResult && Array.isArray(parsedResult.scaledInstructions)) {
                scaledInstructionsResult = parsedResult.scaledInstructions.map((item: any) => String(item)); // Ensure strings
                console.log('Successfully parsed scaled instructions from Gemini response.');
             } else {
                throw new Error("Parsed JSON result did not have the expected 'scaledInstructions' array.");
             }
           } catch (parseErr) {
             console.error('Failed to parse scaled instructions JSON from Gemini response:', parseErr);
             console.error('Raw content that failed parsing:', responseText);
             scaleError = 'Invalid JSON format received from AI instruction scaler.';
           }
        } else {
          scaleError = 'Empty response received from AI instruction scaler.';
        }

    } catch (err) {
        scaleError = err instanceof Error ? err.message : 'Unknown Gemini scale error';
        console.error('Gemini scale API call error:', err);
        // Handle safety blocks
        if ((err as any)?.response?.promptFeedback?.blockReason) {
            scaleError = `Gemini blocked the prompt/response due to safety settings: ${ (err as any).response.promptFeedback.blockReason }`;
        }
    } finally {
        scaleTime = Date.now() - scaleStartTime; // End timing
        console.log(`Gemini Scale Time: ${scaleTime}ms`); // Log time
    }

    // --- Send response or error ---
    if (scaleError || !scaledInstructionsResult) {
      console.error(`Failed to scale instructions with Gemini: ${scaleError || 'Result was null'}`);
      // Returning original instructions on failure to avoid breaking the flow entirely
      console.warn("Returning original instructions due to scaling failure.");
      res.json({ scaledInstructions: instructionsToScale }); 
      // Alternatively, return a 500 error:
      // return res.status(500).json({ error: `Failed to scale instructions: ${scaleError || 'Unknown error'}` });
    } else {
        res.json({ scaledInstructions: scaledInstructionsResult });
    }

   } catch (error) {
      console.error("Error in /scale-instructions route:", error);
      res.status(500).json({ error: 'Internal server error processing instruction scaling request.' });
  }
});

export const recipeRouter = router