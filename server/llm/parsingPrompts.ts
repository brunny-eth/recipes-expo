import { PromptPayload } from './adapters';

const COMMON_SYSTEM_PROMPT = `You are an expert recipe parsing AI. Parse the provided recipe into a valid JSON object.

Expected JSON format:
{
  "title": "string | null",
  "ingredientGroups": [ 
    {
      "name": "string", 
      "ingredients": [
        {
          "name": "string",
          "amount": "string | null",
          "unit": "string | null",
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
  } | null
}

Parsing Rules:
- **Title Generation**: If a title is not explicitly mentioned, create a descriptive, human-readable title for the recipe based on its ingredients and instructions. The title should be concise and accurately represent the dish.
- If a value is not found or is not explicitly mentioned in the recipe text, use null (do not infer or generate).
- **Time Extraction (prepTime, cookTime, totalTime):** Extract durations from the recipe text (e.g., "PT15M", "30 minutes", "1 hour") and convert them into a concise, human-readable string format (e.g., "15 minutes", "30 minutes", "1 hour"). ONLY extract if explicitly stated. Ensure 'totalTime' represents the full duration including both prep and cook time, or the explicitly stated total duration if available. If a time range is given (e.g., "30-45 minutes"), capture the range as is.
- **Yield Extraction (recipeYield):** Extract the yield as a concise string (e.g., "4 servings", "12 cookies") from phrases like "Serves 4", "Yield: 12", "Makes 12 servings", "Serves 4-6". If a range, capture it as a range (e.g., "4-6 servings").
- **Ingredient Grouping:** When a recipe has distinct logical sections for ingredients (e.g., "For the Sauce", "Salad Dressing", "Meatball Mixture", "Tzatziki", "Garnish"), group ingredients appropriately under a concise, descriptive "ingredientGroup" name. If no distinct sections are present, use a single group named "Main".
-  If an instruction step contains a vague phrase like "all ingredients" or "all sauce ingredients," expand the instruction by including a comma-separated list of the relevant ingredients from the corresponding ingredientGroup's ingredients array.
- **Ingredient Substitutions:** For each individual ingredient, suggest 1-2 sensible and common substitutions. If no suitable or obvious substitution exists for an ingredient, set its suggested_substitutions array to null.
- **Amount Conversion:** Convert all fractional amounts (e.g., "1/2", "3/4", "1 1/2") to their decimal equivalents (e.g., "0.5", "0.75", "1.5").
- **Content Filtering:** Exclude all brand names, product names, or any other promotional/non-recipe specific text from all extracted fields.
- **Ingredient Extraction from Sentences**: Some ingredients may only be mentioned within the instruction text. You must extract these as standalone ingredients with a reasonable estimate for quantity and unit, and place them in the appropriate ingredient group. Preserve their order when possible.
- **Ignore Social Media Content**: Explicitly ignore user handles (e.g., "@username") and hashtags (e.g., "#recipe") when parsing. Do not include them in any field.
- Output ONLY the JSON object, with no additional text or explanations.`;

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
The following text is a caption from a ${platform} video.
Your task is to parse this caption into the standard recipe JSON format, following the rules provided in the system prompt.

**Special Instructions for Video Captions:**
- Video captions often contain irrelevant text (e.g., "Follow for more!", "link in bio!").
- You MUST ignore user handles (e.g., "@username"), hashtags (e.g., "#recipe"), and any other promotional or non-recipe content.
- Your focus is solely on extracting the recipe.

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