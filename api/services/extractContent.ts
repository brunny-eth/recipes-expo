import * as cheerio from 'cheerio';
import logger from '../lib/logger';

// Type definitions that might be shared or imported if structure grows
export type ExtractedContent = {
  title: string | null;
  ingredientsText: string | null;
  instructionsText: string | null;
  recipeYieldText?: string | null;
  isFallback?: boolean;
  prepTime?: string | null;
  cookTime?: string | null;
  totalTime?: string | null;
};

/**
 * Extracts recipe content (title, ingredients, instructions) from HTML.
 * Tries JSON-LD first, then falls back to common CSS selectors.
 * @param html The HTML content string.
 * @returns An object containing extracted title, ingredients text, and instructions text.
 */
export function extractRecipeContent(html: string): ExtractedContent | null {
  let $ = cheerio.load(html); // Load initial HTML

  // Initialize extracted fields
  let title: string | null = null;
  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;
  let recipeYieldText: string | null = null;
  let isFallback = false;
  let prepTime: string | null = null;
  let cookTime: string | null = null;
  let totalTime: string | null = null;

  // Tier 1: Try JSON-LD
  let recipeJson: any = null;
  let ldJsonBlocksScanned = 0; // For logging
  let recipeFoundInLdJson = false; // For logging

  $('script[type="application/ld+json"]').each((_, element) => {
    // if (recipeJson) return; // REMOVED: We want to scan all and pick the first valid Recipe
    ldJsonBlocksScanned++;
    try {
      const scriptContent = $(element).html();
      if (!scriptContent) {
          return; 
      }
      
      console.log(`Found potential JSON-LD script content (first 2000 chars):\n${scriptContent.slice(0, 2000)}`);

      const jsonData = JSON.parse(scriptContent);
      let candidate = null;

      if (Array.isArray(jsonData)) {
        candidate = jsonData.find(item => item && item['@type'] === 'Recipe');
      } else if (jsonData && jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
        candidate = jsonData['@graph'].find((item: any) => item && item['@type'] === 'Recipe');
      } else if (jsonData && jsonData['@type'] === 'Recipe') {
        candidate = jsonData;
      }

      if (candidate && !recipeJson) { // If a recipe candidate is found and we haven't stored one yet
        recipeJson = candidate;
        recipeFoundInLdJson = true; // Mark that we found and are using a recipe from JSON-LD
        // Do not return here; continue scanning in case a more complete Recipe object is found later?
        // For now, per the suggestion, we take the first valid one.
      }

    } catch (e) {
      console.warn("Ignoring JSON-LD parsing error:", e);
    }
  });

  console.log(`[JSON-LD Scan] Scanned ${ldJsonBlocksScanned} ld+json blocks. Recipe type found and used: ${recipeFoundInLdJson}.`); // Logging

  if (recipeJson) { // This condition now means a valid Recipe object was found and assigned
    console.log("Found and using recipe data from JSON-LD."); // Updated log message
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

    // --- Extract Time Fields from JSON-LD --- 
    prepTime = recipeJson.prepTime || null;
    cookTime = recipeJson.cookTime || null;
    totalTime = recipeJson.totalTime || null;
    // --- End Time Field Extraction --- 

    // Fallback title extraction if needed, only if JSON-LD didn't yield one
    if (!title) title = $('title').first().text() || $('h1').first().text() || null;

    console.log(`Extracted from JSON-LD - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}, Yield: ${!!recipeYieldText}, Prep: ${!!prepTime}, Cook: ${!!cookTime}, Total: ${!!totalTime}`);
    // If JSON-LD provides the essentials (ingredients AND instructions), return it (including times)
    if (ingredientsText && instructionsText) {
        return { title, ingredientsText, instructionsText, recipeYieldText, isFallback, prepTime, cookTime, totalTime };
    }
    // Continue to selector fallback if JSON-LD was incomplete for essentials
  }

  // --- Pre-stripping & Content Isolation (MOVED HERE) ---
  // This runs if JSON-LD was not found or was incomplete for essentials.
  console.log("JSON-LD not found or incomplete for essentials. Applying pre-stripping and attempting main content isolation before selector fallback.");
  
  // Create a new Cheerio instance from the original HTML for pre-stripping,
  // as the original '$' might have been modified if mainContentHtml was previously loaded.
  // However, we should operate on the version of '$' that reflects the current state.
  // If mainContentHtml was *already* isolated due to a previous iteration (which shouldn't happen with this new flow),
  // we'd want to use that. But since JSON-LD failed, we re-evaluate from potentially broader HTML.
  // The initial '$' is still the full HTML at this point if JSON-LD parsing didn't result in an early return.

  // Remove common non-content tags from the *current* Cheerio instance
  $('script, style, iframe, noscript, footer, nav').remove();
  // Remove common cookie/consent/modal elements
  $('[id*="consent" i], [class*="consent" i], [id*="cookie" i], [class*="cookie" i], [class*="banner" i], [role="dialog" i], [aria-modal="true" i]').remove();

  // Attempt to isolate the main content area from the *current* Cheerio instance
  const mainSelectors = [
      'article[id*="recipe" i]',
      'div[id*="recipe" i]',
      'div[class*="recipe-content" i]',
      'div[class*="wprm-recipe-container" i]', // Common recipe plugin class
      'main[id*="main" i]',
      'main',
      'article'
  ];
  let mainContentHtml: string | null = null;
  for (const selector of mainSelectors) {
      const mainElement = $(selector).first();
      if (mainElement.length > 0) {
          const potentialHtml = mainElement.html();
          if (potentialHtml && potentialHtml.length > 500) {
              console.log(`Found potential main content container using selector: ${selector}. Reloading Cheerio with this content.`);
              mainContentHtml = potentialHtml;
              break;
          }
      }
  }

  if (mainContentHtml) {
      $ = cheerio.load(mainContentHtml); // Reload Cheerio with only the main content for subsequent selector parsing
  } else {
      console.log("Could not isolate a specific main content container after JSON-LD attempt, proceeding with pre-stripped body for selectors.");
  }
  // --- End Pre-stripping & Isolation ---

  // Tier 2: Fallback to Selectors (or run if JSON-LD was incomplete)
  // Note: The console log for this was moved up to the start of the pre-stripping block.
  if (!title) { // Title might have been parsed by JSON-LD even if other fields were missing
    const titleFromSelectors = $('title').first().text() || $('h1').first().text() || null;
    if (titleFromSelectors) title = titleFromSelectors;
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

  // --- Fallback Logic (New Implementation) ---
  // Fallback: use raw body text if no structured content was found or content is too short.
  const minLengthThreshold = 50;
  const ingredientsMissingOrShort = !ingredientsText || ingredientsText.length < minLengthThreshold;
  const instructionsMissingOrShort = !instructionsText || instructionsText.length < minLengthThreshold;

  if (ingredientsMissingOrShort || instructionsMissingOrShort) {
    console.warn(`[extractContent] Fallback: using raw body text due to missing or short (${minLengthThreshold} chars) ingredients and/or instructions.`);
    // Refined cleaning: Collapse multiple spaces, collapse multiple newlines, then trim.
    const rawBodyText = $('body').text()
      .replace(/ +/g, ' ')        // Collapse multiple spaces to one
      .replace(/\n\s*\n/g, '\n')  // Collapse multiple newlines (optional whitespace between) to one
      .trim();
    isFallback = true; // Set the flag when fallback occurs

    // Only overwrite if the original extraction was insufficient
    if (ingredientsMissingOrShort) {
      ingredientsText = rawBodyText;
    }
    if (instructionsMissingOrShort) {
      instructionsText = rawBodyText;
    }
  }

  // --- Content Quality Filter for Fallback ---
  // Only run if isFallback is true
  if (isFallback) {
    // 1. If both ingredientsText and instructionsText are missing or < 50 chars, return null
    const ingLen = ingredientsText ? ingredientsText.length : 0;
    const instLen = instructionsText ? instructionsText.length : 0;
    if (ingLen < 50 && instLen < 50) {
      logger.warn({ reason: 'fallback extraction contained no usable data (both ingredients and instructions missing or too short)' }, '[extractRecipeContent] Fallback extraction rejected: both ingredients and instructions missing or too short');
      return null;
    }
    // 2. If ingredientsText is present but contains no numeric characters, return null
    if (ingredientsText && !ingredientsText.match(/[\d¼½¾⅓⅔⅛⅜⅝⅞]/)) {
      logger.warn({ reason: 'fallback extraction: ingredientsText contains no numeric characters' }, '[extractRecipeContent] Fallback extraction rejected: ingredientsText contains no numeric characters');
      return null;
    }
  }

  console.log(`Final Extracted Content - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}, Yield: ${!!recipeYieldText}, Prep: ${!!prepTime}, Cook: ${!!cookTime}, Total: ${!!totalTime}, Fallback Used: ${isFallback}`);
  // Return structure includes the fallback flag again
  return { title, ingredientsText, instructionsText, recipeYieldText, isFallback, prepTime, cookTime, totalTime };
}
