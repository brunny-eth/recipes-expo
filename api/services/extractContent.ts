import * as cheerio from 'cheerio';

// Type definitions that might be shared or imported if structure grows
type ExtractedContent = {
  title: string | null;
  ingredientsText: string | null;
  instructionsText: string | null;
  recipeYieldText?: string | null;
};

/**
 * Extracts recipe content (title, ingredients, instructions) from HTML.
 * Tries JSON-LD first, then falls back to common CSS selectors.
 * @param html The HTML content string.
 * @returns An object containing extracted title, ingredients text, and instructions text.
 */
export function extractRecipeContent(html: string): ExtractedContent {
  const $ = cheerio.load(html);
  let title: string | null = null;
  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;
  let recipeYieldText: string | null = null;

  // Tier 1: Try JSON-LD
  let recipeJson: any = null;
  $('script[type="application/ld+json"]').each((_, element) => {
    if (recipeJson) return; // Stop if already found
    try {
      const scriptContent = $(element).html();
      if (!scriptContent) return;
      const jsonData = JSON.parse(scriptContent);

      // Check if jsonData is the recipe object or contains it in a graph
      if (jsonData['@type'] === 'Recipe') {
        recipeJson = jsonData;
      } else if (Array.isArray(jsonData) && jsonData.some(item => item['@type'] === 'Recipe')) {
         recipeJson = jsonData.find(item => item['@type'] === 'Recipe');
      } else if (jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
         recipeJson = jsonData['@graph'].find((item: any) => item['@type'] === 'Recipe');
      }
    } catch (e) {
      console.warn("Ignoring JSON-LD parsing error:", e);
    }
  });

  if (recipeJson) {
    console.log("Found recipe via JSON-LD.");
    title = recipeJson.name || null;
    // Ingredients can be string[]
    if (Array.isArray(recipeJson.recipeIngredient)) {
       ingredientsText = recipeJson.recipeIngredient.join('\n');
    }
    // Instructions can be string, string[], or array of HowToStep objects
    if (typeof recipeJson.recipeInstructions === 'string') {
        instructionsText = recipeJson.recipeInstructions;
    } else if (Array.isArray(recipeJson.recipeInstructions)) {
        // Check if it's an array of strings or HowToStep objects
        if (recipeJson.recipeInstructions.every((item: any) => typeof item === 'string')) {
            instructionsText = recipeJson.recipeInstructions.join('\n');
        } else if (recipeJson.recipeInstructions.every((item: any) => typeof item === 'object' && item.text)) {
            // Array of HowToStep objects (common format)
            instructionsText = recipeJson.recipeInstructions.map((step: any) => step.text).join('\n');
        } else if (recipeJson.recipeInstructions.every((item: any) => typeof item === 'object' && item['@type'] === 'HowToSection')) {
             // Handle sections containing steps
             instructionsText = recipeJson.recipeInstructions
                .flatMap((section: any) => section.itemListElement || [])
                .map((step: any) => step.text)
                .join('\n');
        }
    }
    // Extract recipeYield from JSON-LD if available
    if (recipeJson.recipeYield) {
      if (Array.isArray(recipeJson.recipeYield)) {
        // Handle cases where yield might be an array (e.g., "6 servings", "makes 12 cookies")
        // We'll take the first one or try to make sense of it.
        // For simplicity, join if it's an array of strings, or take first if complex.
        recipeYieldText = recipeJson.recipeYield.join(', '); // Or more sophisticated joining
      } else {
        recipeYieldText = String(recipeJson.recipeYield);
      }
    }
    // Fallback title extraction if needed, only if JSON-LD didn't yield one
    if (!title) title = $('title').first().text() || $('h1').first().text() || null;

    console.log(`Extracted from JSON-LD - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}, Yield: ${!!recipeYieldText}`);
    // If JSON-LD provides all key parts, prefer it and return early
    if (title && ingredientsText && instructionsText && recipeYieldText) {
        return { title, ingredientsText, instructionsText, recipeYieldText };
    }
    // Continue to selector fallback if JSON-LD was incomplete
  }

  // Tier 2: Fallback to Selectors (or run if JSON-LD was incomplete)
  console.log("JSON-LD not found or incomplete for all fields. Trying selectors.");
  if (!title) { // Only grab title from selectors if JSON-LD (or its internal fallback) didn't provide it
    title = $('title').first().text() || $('h1').first().text() || null;
  }

  // Ingredient Selectors
  if (!ingredientsText) {
      const ingredientSelectors = [
        '[itemprop="recipeIngredient"]',
        '.wprm-recipe-ingredient', 
        '.tasty-recipes-ingredients li', 
        '.easyrecipe-ingredient',
        '.recipe-ingredients li',
        '.ingredients li',
        '.ingredient-list li'
      ];
      const collectedIngredients = new Set<string>();
      for (const selector of ingredientSelectors) {
          $(selector).each((_, el) => {
              const text = $(el).text().trim();
              if (text) collectedIngredients.add(text);
          });
      }
      if (collectedIngredients.size > 0) {
          ingredientsText = Array.from(collectedIngredients).join('\n');
      }
  }

  // Instruction Selectors
  if (!instructionsText) {
      const tempInstructionsSet = new Set<string>();
      const itemLevelSelectors = [
          '.wprm-recipe-instructions li', '.wprm-recipe-instructions p',
          '.tasty-recipes-instructions li', '.tasty-recipes-instructions p',
          '.easyrecipe-instructions li', '.easyrecipe-instructions p',
          '.recipe-instructions li', '.recipe-instructions p',
          '.instructions li', '.instructions p',
          '.direction-list li', '.direction-list p',
          '[itemprop="recipeInstructions"] li', '[itemprop="recipeInstructions"] p',
          '[itemprop="recipeInstructions"]'
      ];
      const blockLevelSelectors = [
          '.wprm-recipe-instructions',
          '.tasty-recipes-instructions',
          '.easyrecipe-instructions-content',
          '.recipe-instructions',
          '.instructions',
          '.directions'
      ];

      for (const selector of itemLevelSelectors) {
          $(selector).each((_, el) => {
              const text = $(el).text().trim();
              const isLikelyContainer = $(el).children().length > 0 && !$(el).is('li, p');
              if (text && !isLikelyContainer) {
                tempInstructionsSet.add(text);
              } else if (text && isLikelyContainer) {
                const lines = text.split(/\r\n|\n|\r/).map(line => line.trim()).filter(line => line);
                lines.forEach(line => tempInstructionsSet.add(line));
              }
          });
      }

      if (tempInstructionsSet.size === 0) {
          for (const selector of blockLevelSelectors) {
              const elements = $(selector);
              if (elements.length > 0) {
                   elements.each((_, el) => {
                       const blockText = $(el).text().trim();
                       if (blockText) {
                           const lines = blockText.split(/\r\n|\n|\r/).map(line => line.trim()).filter(line => line);
                           lines.forEach(line => tempInstructionsSet.add(line));
                       }
                   });
                   if (tempInstructionsSet.size > 0) break;
              }
          }
      }
      if (tempInstructionsSet.size > 0) {
          instructionsText = Array.from(tempInstructionsSet).join('\n');
      }
  }

  // Yield Selectors (new section)
  if (!recipeYieldText) { // Only run if JSON-LD didn't provide it
    const yieldSelectors = [
      '.wprm-recipe-servings', '.wprm-recipe-yield',
      '.tasty-recipes-yield', '.tasty-recipes-details .recipe-yield',
      '.easyrecipe-servings', '.mf-recipe-servings',
      '[itemprop="recipeYield"]', '[data-mv-recipe-meta="servings"] .mv-value',
      // Generic selectors looking for keywords if specific classes fail
      'div:contains("Servings:")', 'span:contains("Servings:")', 'p:contains("Servings:")',
      'div:contains("Yield:")', 'span:contains("Yield:")', 'p:contains("Yield:")',
      'div:contains("Makes:")', 'span:contains("Makes:")', 'p:contains("Makes:")'
    ];
    let foundYield = false;
    for (const selector of yieldSelectors) {
      if (foundYield) break;
      // For keyword selectors, we need more careful extraction
      if (selector.includes(':contains')) {
        const keyword = selector.substring(selector.indexOf('"') + 1, selector.lastIndexOf('"'));
        const tagName = selector.substring(0, selector.indexOf(':'));
        $(tagName).each((_, el) => {
          const elementText = $(el).text();
          if (elementText.toLowerCase().includes(keyword.toLowerCase())) {
            // Try to get the most specific text containing the keyword and its value
            // This is a simple approach; might need refinement
            const lines = elementText.split('\n').map(line => line.trim()).filter(line => line.toLowerCase().includes(keyword.toLowerCase()));
            if (lines.length > 0) {
              recipeYieldText = lines[0]; // Take the first line that contains the keyword
              foundYield = true;
              return false; // Break from .each()
            }
          }
        });
      } else {
        // For class/attribute selectors
        $(selector).each((_, el) => {
          const text = $(el).text().trim();
          if (text) {
            recipeYieldText = text;
            foundYield = true;
            return false; // Break from .each()
          }
        });
      }
    }
    if (recipeYieldText) {
      console.log(`Extracted recipeYieldText using selectors: ${recipeYieldText}`);
    }
  }

  console.log(`Final Extracted Content - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}, Yield: ${!!recipeYieldText}`);
  return { title, ingredientsText, instructionsText, recipeYieldText };
}
