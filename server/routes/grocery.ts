import { Router, Request, Response } from 'express';
import { runDefaultLLM } from '../llm/adapters';
import { stripMarkdownFences } from '../utils/stripMarkdownFences';
import logger from '../lib/logger';

const router = Router();

// Middleware to log all incoming requests to this router
router.use((req, res, next) => {
    logger.info({
        requestId: (req as any).id,
        method: req.method,
        path: req.originalUrl,
    }, 'Incoming request to /api/grocery router');
    next();
});

interface CategorizeIngredientsRequest {
    ingredients: string[];
}

interface CategorizeIngredientsResponse {
    categories: { [ingredient: string]: string };
    error?: string;
}

// POST /api/grocery/categorize-ingredients
router.post('/categorize-ingredients', async (req: Request, res: Response) => {
    const requestId = (req as any).id;
    
    try {
        const { ingredients } = req.body as CategorizeIngredientsRequest;
        
        logger.info({ 
            requestId, 
            ingredientCount: ingredients?.length || 0
        }, 'Received request to categorize ingredients');
        
        // Validate required fields
        if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
            logger.error({ requestId, body: req.body }, 'Missing or invalid ingredients array');
            return res.status(400).json({ error: 'Missing or invalid ingredients array' });
        }
        
        // Validate ingredients are strings
        if (!ingredients.every(ing => typeof ing === 'string')) {
            logger.error({ requestId, ingredients }, 'All ingredients must be strings');
            return res.status(400).json({ error: 'All ingredients must be strings' });
        }
        
        // Build the categorization prompt
        const ingredientList = ingredients.map(ing => `"${ing}"`).join(', ');
        
        const systemPrompt = `
You are an expert grocery organizer. Categorize the following ingredients into appropriate grocery store sections.

Available categories:
- Produce
- Dairy & Eggs  
- Meat & Seafood
- Pantry
- Bakery
- Frozen
- Beverages
- Condiments & Sauces
- Spices & Herbs
- Snacks
- Health & Personal Care
- Other

Rules:
1. Use the exact category names from the list above.
2. Be consistent - same ingredients should always go to the same category.
3. If an ingredient could fit multiple categories, choose the most common/logical one.
4. For prepared or processed items, categorize based on where they're typically found in stores.

Return your response as a JSON object where each ingredient name is a key and its category is the value.

Example:
{
  "chicken breast": "Meat & Seafood",
  "milk": "Dairy & Eggs",
  "onions": "Produce",
  "olive oil": "Pantry"
}`;

        const userPrompt = `Categorize these ingredients: ${ingredientList}`;
        
        logger.info({ requestId, ingredientCount: ingredients.length }, 'Sending categorization request to LLM');
        
        const { output, error, usage } = await runDefaultLLM({
            system: systemPrompt,
            text: userPrompt,
            isJson: true,
            metadata: { requestId }
        });
        
        if (error || !output) {
            logger.error({ requestId, error }, 'Failed to categorize ingredients with LLM');
            return res.status(500).json({ 
                error: `Failed to categorize ingredients: ${error || 'Unknown error'}`,
                categories: {}
            });
        }
        
        // Parse the LLM response
        const cleanedResponse = stripMarkdownFences(output);
        
        let categories: { [ingredient: string]: string };
        try {
            categories = JSON.parse(cleanedResponse);
        } catch (parseError) {
            logger.error({ requestId, response: cleanedResponse, parseError }, 'Failed to parse LLM response as JSON');
            return res.status(500).json({ 
                error: 'Failed to parse categorization response',
                categories: {}
            });
        }
        
        // Validate the response structure
        if (!categories || typeof categories !== 'object') {
            logger.error({ requestId, categories }, 'Invalid categorization response structure');
            return res.status(500).json({ 
                error: 'Invalid categorization response structure',
                categories: {}
            });
        }
        
        logger.info({ 
            requestId, 
            categorizedCount: Object.keys(categories).length,
            usage
        }, 'Successfully categorized ingredients');
        
        res.status(200).json({
            categories,
            usage
        });
        
    } catch (err) {
        const error = err as Error;
        logger.error({ requestId, err: error, route: req.originalUrl, method: req.method }, 'Error in /categorize-ingredients route');
        res.status(500).json({ 
            error: error.message || 'Internal server error',
            categories: {}
        });
    }
});

// Note: Client-side utility functions (formatIngredientsForGroceryList, aggregateGroceryItems, etc.)
// are tested during React component integration, not via HTTP endpoints.

export { router as groceryRouter }; 