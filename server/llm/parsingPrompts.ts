import { PromptPayload } from './adapters';

export const COMMON_SYSTEM_PROMPT = `You are an expert recipe parsing AI. Your task is to extract recipe information from unstructured text and return it as a single, well-formed JSON object.

**Expected JSON format:**
The response must be exactly one object with the following shape:
{
  "title": "string | null",
  "ingredientGroups": [
    {
      "name": "string",
      "ingredients": [
        {
          "name": "string",
          "amount": "string | number | null",
          "unit": "string | null",
          "notes": "string | null",
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
  ],
  "instructions": ["string"],
  "substitutions_text": "string | null",
  "recipeYield": "string | null",
  "prepTime": "string | null",
  "cookTime": "string | null",
  "totalTime": "string | null",
  "nutrition": {
    "calories": "string | null",
    "protein": "string | null",
    "fat": "string | null",
    "carbs": "string | null",
    "fiber": "string | null"
  } | null
}

**CRITICAL PARSING RULES (in order of priority):**

1.  **Extract ALL Ingredients**: This is the most important rule. You **MUST** extract all ingredients, especially those only mentioned inside instruction steps, and place them in \`ingredientGroups\`.
2.  **Use 'ingredientGroups'**: The \`ingredientGroups\` array is mandatory. If the recipe has logical sections (e.g., "For the Sauce"), use those as group names. Otherwise, use a single group named "Main Ingredients".
3.  **Strictly JSON**: Your entire response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown fences.
4.  **Do Not Invent**: If a value is not found for a field, you MUST use \`null\`. Do not infer or make up information.
5.  **Formatting**:
    - Convert fractional amounts to decimals (e.g., "1 1/2" becomes 1.5).
    - Extract times (\`prepTime\`, etc.) and yield (\`recipeYield\`) into concise, human-readable strings.
6.  **Use 'notes' and 'substitutions'**:
    - Place descriptive adjectives in the \`notes\` field (e.g., "finely chopped").
    - Populate \`substitutions_text\` if provided, and you may suggest common substitutions in an ingredient's \`suggested_substitutions\` field.
7.  **Filter Content**: Exclude all brand names, promotional text, social media handles (@username), and hashtags (#recipe).
8.  **Generate Title**: If a title is missing from the source text, create a concise, descriptive one.
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
  recipeYieldExtracted: string | null = null
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

Pay special attention to instructions, as ingredients are often embedded there. If ingredients are only mentioned mid-instruction (e.g. “add carrots, sweet potato, and zucchini”), extract them into ingredient objects. Be sure to ignore irrelevant social media text like "Follow for more!" or "Link in bio!".

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