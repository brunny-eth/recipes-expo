import { PromptPayload } from './adapters';

export const COMMON_SYSTEM_PROMPT = `You are an expert recipe parsing AI. Your task is to extract recipe information from unstructured text and return it as a single, well-formed JSON object.

**Expected JSON format:**
The response must be exactly one object with the following shape:
{
  "title": "string | null",
  "shortDescription": "string | null",
  "ingredientGroups": [
    {
      "name": "string",
      "ingredients": [
        {
          "name": "string",
          "amount": "string | number | null",
          "unit": "string | null",
          "preparation": "string | null",
          "suggested_substitutions": [
            {
              "name": "string",
              "amount": "string | number | null",
              "unit": "string | null",
              "description": "string | null"
            }
          ] | null
        }
      ]
    }
  ] | null,
  "instructions": "array of strings, each a single step without numbering | null",
  "substitutions_text": "string | null",
  "recipeYield": "string | null",
  "prepTime": "string | null",
  "cookTime": "string | null",
  "totalTime": "string | null",
  "nutrition": {
    "calories": "string | null",
    "protein": "string | null"
  } | null,
  "tips": "string | null"
}

**CRITICAL PARSING RULES (All rules are equally important):**

1.  **Comprehensive Ingredient Extraction**: This is paramount. You **MUST** extract all ingredients, including those mentioned only within instruction steps, and place them in 'ingredientGroups'.
2.  **Ingredient Grouping:** When a recipe has distinct logical sections for ingredients (e.g., "For the Sauce", "Salad Dressing", "Meatball Mixture", "Tzatziki", "Garnish"), group ingredients appropriately under a concise, descriptive "ingredientGroup" name. If no distinct sections are present, use a single group named "Main". If there are ingredients for serving, place them in a group named "Serving".

3.  **Instruction Reference Expansion (REQUIRED):** When an instruction step contains vague references like "all [group name] ingredients", "the [group name]", or "[group name]", you MUST:
    - Treat these as ingredient group aliases
    - Match them loosely against the ingredientGroups[].name (case-insensitive, partial match is OK)
    - When a match is found, expand the instruction to include a comma-separated list of the ingredients from that group
    - Examples:
      * "Mix all dressing ingredients" → "Mix olive oil, red wine vinegar, and mustard"
      * "Add the marinade" → "Add soy sauce, garlic, and ginger"
      * "Stir in the sauce" → "Stir in tomatoes, onions, and herbs"
    - This expansion is CRITICAL for app functionality and user experience
4.  Output ONLY the requested JSON object. Do NOT include any additional text or explanations.
5.  **No Inference; Use Null**: If a value for a field is not explicitly found in the provided text, you MUST use 'null'. Do not infer or generate information.
6.  **Time Formatting (prepTime, cookTime, totalTime)**:
    * **Convert durations into concise, human-readable strings (e.g., "15 minutes", "30 minutes", "1 hour", "1 hour 30 minutes").**
    * **DO NOT use ISO 8601 duration format (e.g., "PT15M").**
    * Only extract if explicitly stated. Capture time ranges as given (e.g., "30-45 minutes").
7.  **Yield Formatting (recipeYield)**: Extract the yield into a concise, human-readable string (e.g., "4 servings", "12 cookies", "4-6 servings").
8.  Ingredient Substitutions (suggested_substitutions): For every ingredient, YOU MUST suggest 1–2 realistic substitutions as fully filled-out objects. You may reasonably guess amounts and units if they make culinary sense. If no good substitution exists, set suggested_substitutions to null. For meat, seafood, and poultry, try to give at least 1 vegetarian substitution. NEVER include substitutions with all fields null.
9.  **Amount Conversion**: Convert all fractional amounts (e.g., "1/2", "3/4", "1 1/2") to their decimal equivalents (e.g., "0.5", "0.75", "1.5").
10. **Ingredient Preparation (preparation)**: Place any specific preparation instructions for an ingredient into the 'preparation' field (e.g., "finely chopped", "melted", "zest", "diced", "room temperature"). The 'name' field should contain the core ingredient name (e.g., "carrots", not "finely chopped carrots").
11. **Content Filtering**: Exclude all brand names, product names, promotional text, social media handles (@username), and hashtags (#recipe) from all extracted fields.
12. **Title Generation**: If a title is missing from the source text, create a concise, descriptive title for the recipe.
13. **Short Description**: Write a <10 word, vivid, natural-language description of the dish (e.g., "Cheesy quesadillas with smoky adobo ranch"). Avoid promo or filler text. Set to null if insufficient context.
14. If no stated yield is found, estimate the yield. Use context clues (e.g., 4 chicken thighs = 4 servings). Do your best to estimate. 
15. **Instruction Length Control**: Each instruction step MUST be 1-2 sentences maximum. If an instruction contains multiple steps or complex procedures, break it into separate, focused instruction steps. Each step should be clear, actionable, and concise.
16. **Tips Extraction**: Extract relevant cooking tips, tricks, or helpful advice mentioned in the text into the 'tips' field. This includes equipment recommendations (e.g., "use a cast iron skillet for best results" or "if you don't have galangal or kefir lime leaves, you can also swap ginger and fresh lime juice"), technique suggestions, timing advice, or any other helpful guidance that isn't explicitly an instruction. These may be in the form of a 'Recipe Notes' or 'Tips' section, or just plainly in text. BUT DO NOT include any promotional text ("sign up for our newsletter" or similar) in the tips field.
`;

export function buildTextParsePrompt(input: string, fromImageExtraction: boolean = false): PromptPayload {
  const basePrompt = COMMON_SYSTEM_PROMPT;
  
  // If this is from image extraction, add guidance for handling potentially structured input
  const enhancedPrompt = fromImageExtraction ? 
    basePrompt + `

**ADDITIONAL GUIDANCE FOR IMAGE-EXTRACTED TEXT:**
This text was extracted from an image/PDF. It may be:
- Well-structured JSON (preserve core data, add missing substitutions/fields)
- Unstructured text (parse normally following all standard rules)

If the input appears to be valid JSON with recipe data already structured:
- PRESERVE the existing title, ingredient names, and instruction content
- ENHANCE by adding missing suggested_substitutions and other fields
- DO NOT reinterpret or change the core recipe information

If the input is unstructured text, follow the standard parsing rules completely.` 
    : basePrompt;

  return {
    system: enhancedPrompt,
    text: input,
    isJson: true
  };
}

export function buildUrlParsePrompt(
  title: string,
  ingredients: string,
  instructions: string,
  prepTimeExtracted: string | null = null,
  cookTimeExtracted: string | null = null,
  totalTimeExtracted: string | null = null,
  recipeYieldExtracted: string | null = null,
  tipsExtracted: string | null = null
): PromptPayload {
  const combinedText = `
Title: ${title}
Prep Time: ${prepTimeExtracted || 'N/A'}
Cook Time: ${cookTimeExtracted || 'N/A'}
Total Time: ${totalTimeExtracted || 'N/A'}
Yield: ${recipeYieldExtracted || 'N/A'}
Ingredients:
${ingredients}

Instructions:
${instructions}
${tipsExtracted ? `\nTips and Notes:\n${tipsExtracted}` : ''}
`.trim();

  return {
    system: COMMON_SYSTEM_PROMPT,
    text: combinedText,
    isJson: true
  };
}

export function buildVideoParsePrompt(caption: string, platform: string): PromptPayload {
  const userText = `
The following text is a caption from a ${platform} video. Your task is to parse it into the standard recipe JSON format, following all rules from the system prompt.

Pay special attention to instructions, as ingredients are often embedded there. If ingredients are only mentioned mid-instruction (e.g. “add carrots, sweet potato, and zucchini”), extract them into ingredient objects. Be sure to ignore irrelevant social media text like "Follow for more!" or "Link in bio!". And -  If an instruction step contains a vague phrase like "all ingredients" or "all sauce ingredients," expand the instruction by including a comma-separated list of the relevant ingredients from the corresponding ingredientGroup's ingredients array.


---
VIDEO CAPTION TO PARSE:
---
${caption}
`;

  return {
    system: COMMON_SYSTEM_PROMPT,
    text: userText.trim(),
    isJson: true,
  };
}

export function buildImageParsePrompt(imageDataArray?: Array<{ mimeType: string; data: string }>): PromptPayload {
    const isMultiImage = imageDataArray && imageDataArray.length > 1;
    
    const instructions = isMultiImage 
        ? `Extract the complete recipe text from these images. The recipe may be spread across multiple pages or images. Please:

1. **Combine information from all images** - ingredients from one image, instructions from another, etc.
2. **Extract ALL visible text** including ingredients, instructions, cooking times, temperatures, and serving information
3. **Ignore non-recipe content** like ads, other recipes, or unrelated text
4. **Return as plain text** - do not format as JSON, just extract the raw recipe text

Return the extracted text exactly as it appears, preserving the original formatting and structure.`
        
        : `Extract the complete recipe text from this image. Please:

1. **Extract ALL visible text** including ingredients, instructions, cooking times, temperatures, and serving information  
2. **Ignore non-recipe content** like ads, other recipes, or unrelated text
3. **Return as plain text** - do not format as JSON, just extract the raw recipe text

Return the extracted text exactly as it appears, preserving the original formatting and structure.`;

    return {
        system: COMMON_SYSTEM_PROMPT,
        text: instructions,
        isJson: false, // We want plain text output, not JSON
        imageData: imageDataArray
    };
}