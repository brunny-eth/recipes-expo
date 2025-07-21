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
-  If an instruction step contains a vague phrase like "all ingredients" or "all sauce ingredients," expand the instruction by including a comma-separated list of the relevant ingredients from the corresponding ingredientGroup's ingredients array.
3.  Output ONLY the requested JSON object. Do NOT include any additional text or explanations.
4.  **No Inference; Use Null**: If a value for a field is not explicitly found in the provided text, you MUST use 'null'. Do not infer or generate information.
5.  **Time Formatting (prepTime, cookTime, totalTime)**:
    * **Convert durations into concise, human-readable strings (e.g., "15 minutes", "30 minutes", "1 hour", "1 hour 30 minutes").**
    * **DO NOT use ISO 8601 duration format (e.g., "PT15M").**
    * Only extract if explicitly stated. Capture time ranges as given (e.g., "30-45 minutes").
6.  **Yield Formatting (recipeYield)**: Extract the yield into a concise, human-readable string (e.g., "4 servings", "12 cookies", "4-6 servings").
7.  Ingredient Substitutions (suggested_substitutions): For every ingredient, YOU MUST suggest 1–2 realistic substitutions as fully filled-out objects. You may reasonably guess amounts and units if they make culinary sense. If no good substitution exists, set suggested_substitutions to null. NEVER incldue substitutions with all fields null.
8.  **Amount Conversion**: Convert all fractional amounts (e.g., "1/2", "3/4", "1 1/2") to their decimal equivalents (e.g., "0.5", "0.75", "1.5").
9.  **Ingredient Preparation (preparation)**: Place any specific preparation instructions for an ingredient into the 'preparation' field (e.g., "finely chopped", "melted", "zest", "diced", "room temperature"). The 'name' field should contain the core ingredient name (e.g., "carrots", not "finely chopped carrots").
10. **Content Filtering**: Exclude all brand names, product names, promotional text, social media handles (@username), and hashtags (#recipe) from all extracted fields.
11. **Title Generation**: If a title is missing from the source text, create a concise, descriptive title for the recipe.
12. **Short Description**: Write a <10 word, vivid, natural-language description of the dish (e.g., "Cheesy quesadillas with smoky adobo ranch"). Avoid promo or filler text. Set to null if insufficient context.
13. If no stated yield is found, estimate the yield. Use context clues (e.g., 4 chicken thighs = 4 servings). Do your best to estimate. 
14. **Instruction Length Control**: Each instruction step MUST be 1-2 sentences maximum. If an instruction contains multiple steps or complex procedures, break it into separate, focused instruction steps. Each step should be clear, actionable, and concise.
15. **Tips Extraction**: Extract relevant cooking tips, tricks, or helpful advice mentioned in the text into the 'tips' field. This includes equipment recommendations (e.g., "use a cast iron skillet for best results" or "if you don't have galangal or kefir lime leaves, you can also swap ginger and fresh lime juice"), technique suggestions, timing advice, or any other helpful guidance that isn't explicitly an instruction. These may be in the form of a 'Recipe Notes' or 'Tips' section, or just plainly in text. BUT DO NOT include any promotional text ("sign up for our newsletter" or similar) in the tips field.
`;

export function buildTextParsePrompt(input: string): PromptPayload {
  return {
    system: COMMON_SYSTEM_PROMPT,
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