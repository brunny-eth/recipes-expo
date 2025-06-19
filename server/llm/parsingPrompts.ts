import { PromptPayload } from './adapters';

const COMMON_SYSTEM_PROMPT = `You are an expert recipe parsing AI. Parse the provided recipe into a valid JSON object.

Expected JSON format:
{
  "title": "string | null",
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
- If a value is not found, use null (not "N/A" or empty string).
- Exclude ingredients like "salt", "black pepper", "pepper", "sea salt".
- Extract prepTime, cookTime, totalTime from explicit mentions.
- Extract recipeYield from terms like "Serves 4", "Yield: 12 cookies".
- Extract nutrition info if available.
- Suggest 1-2 sensible substitutions for each ingredient.
- Convert fractional amounts to decimals.
- Output ONLY the JSON object.`;

export function buildTextParsePrompt(input: string): PromptPayload {
  return {
    system: COMMON_SYSTEM_PROMPT,
    text: input,
    isJson: true
  };
}

export function buildUrlParsePrompt(title: string, ingredients: string, instructions: string): PromptPayload {
  const combinedText = `
Title: ${title}
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