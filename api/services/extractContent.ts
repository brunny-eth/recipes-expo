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

// Helper function to validate instruction text
const isValidInstruction = (text: string): boolean => {
    // Filter out common non-instruction patterns
    if (text.match(/^\d+(\.\d+)?\s*(\(\d+.*ratings?\))?$/)) return false; // Matches "4.96 (124 ratings)"
    if (text.match(/^\d+\s*reviews?$/i)) return false; // Matches "124 reviews"
    if (text.match(/^\d+\s*comments?$/i)) return false; // Matches "124 comments"
    if (text.length < 5) return false; // Too short to be an instruction
    
    // Add a stricter early bail-out
    if (text.toLowerCase().includes("nutrition information")) return false;
    if (text.toLowerCase().includes("calculated")) return false;
    if (text.toLowerCase().includes("disclaimer")) return false;
    
    // Look for common instruction keywords or patterns
    const instructionKeywords = [
        'add', 'mix', 'stir', 'cook', 'bake', 'preheat', 'heat', 'combine',
        'place', 'pour', 'set', 'let', 'remove', 'cut', 'chop', 'slice',
        'prepare', 'season', 'serve', 'simmer', 'boil', 'reduce', 'transfer',
        'cover', 'uncover', 'drain', 'rinse', 'arrange', 'spread', 'layer',
        'top', 'garnish', 'sprinkle', 'dip', 'marinate', 'grill', 'roast',
        'blend', 'process', 'fold', 'whisk', 'beat', 'knead', 'rest', 'cool',
        'chill', 'freeze', 'thaw', 'brown', 'sauté', 'fry', 'deep-fry', 'steam',
        'broil', 'toast', 'flip', 'turn', 'rotate', 'stir-fry', 'toss', 'coat',
        'stuff', 'fill', 'pipe', 'shape', 'form', 'roll', 'pat', 'press'
    ];
    const hasKeyword = instructionKeywords.some(keyword => 
        text.toLowerCase().includes(keyword)
    );
    
    // Check for numbered steps or bullet points
    const hasStepPattern = !!text.match(/^(\d+\.|\•|\-|\*|\–|\d+\))\s/);

    // Check for time-related patterns (common in cooking instructions)
    const hasTimePattern = !!text.match(/\d+\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?)/i);
    
    // Check for temperature-related patterns
    const hasTempPattern = !!text.match(/\d+\s*(degrees?|°|[CF])\b/i);

    // Check for measurement-related words (indicating an action)
    const hasMeasurement = !!text.match(/\b(cup|cups|tablespoons?|teaspoons?|pounds?|ounces?|grams?|kilos?|liters?|quarts?|gallons?)\b/i);

    return hasKeyword || hasStepPattern || hasTimePattern || hasTempPattern || hasMeasurement;
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
      'div[class*="wp-block-cookbook" i]',
      'div[class*="cookbook" i]',
      'article[id*="recipe" i]',
      'div[id*="recipe" i]',
      'div[class*="recipe-content" i]',
      'div[class*="wprm-recipe-container" i]', // Common recipe plugin class
      'main[id*="main" i]',
      'main',
      'article'
  ];

  let mainContentHtml: string | null = null;
  let selectedMainSelector: string | null = null; // Track the selector used
  for (const selector of mainSelectors) {
      const mainElement = $(selector).first();
      if (mainElement.length > 0) {
          const potentialHtml = mainElement.html();
          if (potentialHtml && potentialHtml.length > 500) {
              console.log(`Found potential main content container using selector: ${selector}.`);
              mainContentHtml = potentialHtml;
              selectedMainSelector = selector; // Store the selector used
              break;
          }
      }
  }

  if (mainContentHtml) {
      console.log(`Found potential main content container using selector: ${selectedMainSelector}, but skipping cheerio reload to preserve full DOM access.`);
      // Skipping cheerio reload to maintain full DOM access
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
          '.steps li', '.steps p',
          '.method li', '.method p',
          '.preparation li', '.preparation p',
          '[itemprop="recipeInstructions"] li', '[itemprop="recipeInstructions"] p',
          '[itemprop="recipeInstructions"]',
          '.wprm-recipe-instruction',
          '.wprm-recipe-instruction-text'
      ];
      const blockLevelSelectors = [
          '.wprm-recipe-instructions',
          '.tasty-recipes-instructions',
          '.easyrecipe-instructions-content',
          '.recipe-instructions',
          '.instructions',
          '.directions',
          '.steps',
          '.method',
          '.preparation',
          'div[class*="instructions" i]',
          'div[class*="directions" i]',
          'div[class*="steps" i]',
          'div[class*="method" i]',
          'div[class*="preparation" i]'
      ];

      // First try to find ordered lists within recipe containers
      const recipeContainers = [
          'div[id*="recipe" i]',
          'div[class*="recipe" i]',
          'article[class*="recipe" i]',
          'div[class*="cookbook" i]',
          'div[class*="wp-block-cookbook-recipe" i]'
      ];

      for (const container of recipeContainers) {
          const orderedLists = $(`${container} ol`);
          if (orderedLists.length > 0) {
              orderedLists.each((_, list) => {
                  $(list).find('li').each((_, item) => {
                      const text = $(item).text().trim();
                      if (text && isValidInstruction(text)) {
                          tempInstructionsSet.add(text);
                          console.log(`Found valid instruction in list: ${text.substring(0, 50)}...`);
                      }
                  });
              });
          }
          const paragraphs = $(`${container} p`);
          if (paragraphs.length > 0) {
              paragraphs.each((_, p) => {
                  const text = $(p).text().trim();
                  if (text && isValidInstruction(text)) {
                      tempInstructionsSet.add(text);
                      console.log(`Found valid instruction in paragraph: ${text.substring(0, 50)}...`);
                  }
              });
          }
          if (tempInstructionsSet.size > 0) break;
      }

      // If no valid instructions found in ordered lists, try item level selectors
      if (tempInstructionsSet.size === 0) {
          for (const selector of itemLevelSelectors) {
              $(selector).each((_, el) => {
                  const text = $(el).text().trim();
                  const isLikelyContainer = $(el).children().length > 0 && !$(el).is('li, p, div');
                  if (text && !isLikelyContainer && isValidInstruction(text)) {
                      tempInstructionsSet.add(text);
                  } else if (text && isLikelyContainer) {
                      const lines = text.split(/\r\n|\n|\r/)
                          .map(line => line.trim())
                          .filter(line => line && isValidInstruction(line));
                      lines.forEach(line => tempInstructionsSet.add(line));
                  }
              });
          }
      }

      // If still no valid instructions, try block level selectors
      if (tempInstructionsSet.size === 0) {
          for (const selector of blockLevelSelectors) {
              const elements = $(selector);
              if (elements.length > 0) {
                   elements.each((_, el) => {
                       const blockText = $(el).text().trim();
                       if (blockText) {
                           const lines = blockText.split(/\r\n|\n|\r/)
                               .map(line => line.trim())
                               .filter(line => line && isValidInstruction(line));
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
    console.warn(`[extractContent] Attempting additional extraction before raw fallback due to missing or short (${minLengthThreshold} chars) content.`);
    
    // Additional attempt to find instructions in broader context
    if (instructionsMissingOrShort) {
      const tempInstructionsSet = new Set<string>();
      let debugInstructionsFound = 0;
      
      // Look for any ordered or unordered lists that might contain instructions
      $('ol, ul').each((_, list) => {
        const listItems = $(list).find('li');
        if (listItems.length >= 2) { // More lenient: only require 2 items
          let validInstructions = 0;
          listItems.each((_, item) => {
            const text = $(item).text().trim();
            if (text && isValidInstruction(text)) {
              tempInstructionsSet.add(text);
              validInstructions++;
              debugInstructionsFound++;
              console.log(`Found valid instruction: ${text.substring(0, 50)}...`);
            }
          });
          if (validInstructions >= 2) {
            console.log(`Found ${validInstructions} valid instructions in a list element`);
          }
        }
      });

      // Look for paragraphs that might be instructions
      $('p').each((_, p) => {
        const text = $(p).text().trim();
        if (text && isValidInstruction(text) && text.length > 20) {
          tempInstructionsSet.add(text);
          debugInstructionsFound++;
          console.log(`Found valid instruction in paragraph: ${text.substring(0, 50)}...`);
        }
      });

      // Look for div elements that might contain instructions
      $('div').each((_, div) => {
        const text = $(div).text().trim();
        if (text && text.length > 20 && text.length < 500 && isValidInstruction(text)) {
          tempInstructionsSet.add(text);
          debugInstructionsFound++;
          console.log(`Found valid instruction in div: ${text.substring(0, 50)}...`);
        }
      });

      console.log(`[Debug] Total valid instructions found: ${debugInstructionsFound}`);

      if (tempInstructionsSet.size > 0) {
        instructionsText = Array.from(tempInstructionsSet).join('\n');
        console.log(`Found ${tempInstructionsSet.size} valid instructions in broader context`);
      }
    }

    // Only if we still don't have valid content, try raw body text
    const stillMissingIngredients = !ingredientsText || ingredientsText.length < minLengthThreshold;
    const stillMissingInstructions = !instructionsText || instructionsText.length < minLengthThreshold;

    if (stillMissingIngredients || stillMissingInstructions) {
      console.warn(`[extractContent] Fallback: using raw body text as last resort.`);
      const rawBodyText = $('body').text()
        .replace(/ +/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      isFallback = true;

      if (stillMissingIngredients) {
        ingredientsText = rawBodyText;
      }
      if (stillMissingInstructions) {
        const potentialInstructions = rawBodyText
          .split(/\n/)
          .map(line => line.trim())
          .filter(line => {
            const isValid = line && isValidInstruction(line);
            if (isValid) {
              console.log(`Found valid instruction in raw text: ${line.substring(0, 50)}...`);
            }
            return isValid;
          });

        if (potentialInstructions.length >= 2) { // More lenient: only require 2 valid instructions
          instructionsText = potentialInstructions.join('\n');
          console.log(`Found ${potentialInstructions.length} valid instructions in raw text`);
        } else {
          instructionsText = rawBodyText;
        }
      }
    }
  }

  // --- Content Quality Filter for Fallback ---
  if (isFallback) {
    const ingLen = ingredientsText ? ingredientsText.length : 0;
    const instLen = instructionsText ? instructionsText.length : 0;
    
    if (ingLen < 50 && instLen < 50) {
      logger.warn({ reason: 'fallback extraction contained no usable data (both ingredients and instructions missing or too short)' }, '[extractRecipeContent] Fallback extraction rejected: both ingredients and instructions missing or too short');
      return null;
    }
    
    if (ingredientsText && !ingredientsText.match(/[\d¼½¾⅓⅔⅛⅜⅝⅞]/)) {
      logger.warn({ reason: 'fallback extraction: ingredientsText contains no numeric characters' }, '[extractRecipeContent] Fallback extraction rejected: ingredientsText contains no numeric characters');
      return null;
    }

    if (instructionsText) {
      const validInstructions = instructionsText
        .split(/\n/)
        .filter(line => line.trim() && isValidInstruction(line.trim()));
      
      console.log(`[Debug] Found ${validInstructions.length} valid instructions in final content`);
      
      if (validInstructions.length < 2) { // More lenient: only require 2 valid instructions
        logger.warn({ 
          reason: 'fallback extraction: instructionsText contains insufficient valid instructions',
          validCount: validInstructions.length,
          sample: validInstructions.slice(0, 2)
        }, '[extractRecipeContent] Fallback extraction rejected: insufficient valid instructions found');
        return null;
      }
    }
  }

  // Add a stronger fallback rejection check post-Gemini
  if (!title && !ingredientsText?.length && !instructionsText?.length) {
    logger.warn("[extractRecipeContent] Gemini returned empty recipe. Likely not a recipe page.");
    return null;
  }

  console.log(`Final Extracted Content - Title: ${!!title}, Ingredients: ${!!ingredientsText}, Instructions: ${!!instructionsText}, Yield: ${!!recipeYieldText}, Prep: ${!!prepTime}, Cook: ${!!cookTime}, Total: ${!!totalTime}, Fallback Used: ${isFallback}`);
  // Add logging for instructionsText
  console.log("[extractRecipeContent] Final instructionsText preview:\n", instructionsText?.slice(0, 500));
  // Return structure includes the fallback flag again
  return { title, ingredientsText, instructionsText, recipeYieldText, isFallback, prepTime, cookTime, totalTime };
}
