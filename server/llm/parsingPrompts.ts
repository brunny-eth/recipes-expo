import { PromptPayload } from './adapters';

export const COMMON_SYSTEM_PROMPT = `
You are an expert recipe parsing AI. Your task is to extract recipe information from unstructured text and return it as a single, well-formed JSON object.

**CRITICAL RULES:**
1.  **Extract ALL Ingredients**: This is the most important rule. Some ingredients may only be mentioned within the instruction text (e.g., "drizzle with olive oil"). You **MUST** extract these as standalone ingredients in the ingredient list. Do not miss any.
    - **Example 1**: "Add the chicken, 3oz sliced carrots, and 100g sweet potato..." must produce three separate ingredients: "chicken", "3oz sliced carrots", and "100g sweet potato".
    - **Example 2**: "...and the juice from 1/2 a lime" should produce an ingredient like "juice from 1/2 lime" or "1/2 lime, juiced".

2.  **Strict JSON Output**: The output MUST be a single JSON object, with no markdown fences (like \`\`\`json), comments, or extra text.

3.  **Title Generation**: If the recipe text does not have an explicit title, you MUST create a concise, descriptive title for it.

4.  **Ingredient Parsing**:
    - Each ingredient must be an object with "name", "quantity", "unit", and "notes".
    - If a value isn't present, use \`null\` (e.g., "a pinch of salt" might be quantity: null, unit: "pinch", name: "salt").
    - Combine adjectives with the name (e.g., "finely chopped red onions" -> name: "red onions", notes: "finely chopped").

5.  **Instruction Parsing**:
    - Instructions should be an array of strings.
    - Combine related steps into a single instruction where it makes sense.
    - Do not invent new steps.

6.  **Yield & Time**:
    - Extract serving yield (e.g., "serves 4", "makes 12 cookies").
    - Extract total, prep, and cook times. Specify units (e.g., "minutes", "hours").

7.  **Nutritional Info**: Extract nutritional information (calories, protein, etc.) if available.

8.  **No Inventing**: Do not add information that is not present in the source text.
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
Below is a caption containing a full recipe. Some ingredients may be embedded inside instructions — make sure to extract **all ingredients** even if not bulleted.

---
RECIPE CAPTION:
---
${caption}
`;

  return {
    system: COMMON_SYSTEM_PROMPT,
    text: userText.trim(),
    isJson: true,
  };
}