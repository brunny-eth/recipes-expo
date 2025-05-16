export type TextValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Validates if the prepared text likely represents a recipe using heuristics.
 * @param text The text to validate.
 * @param requestId A unique identifier for logging.
 * @returns TextValidationResult indicating if the text is valid and an error message if not.
 */
export function validateRecipeText(
  text: string,
  requestId: string
): TextValidationResult {
  if (!text) {
    // console.warn(`[${requestId}] Text validation failed: Input text is empty.`); // Optional: specific log here
    return {
      isValid: false,
      error: "Input text is empty.",
    };
  }

  const minLength = 100;
  const hasKeywords = /ingredients|directions|instructions|recipe|servings|yield|method|steps/i.test(text);

  if (text.length < minLength && !hasKeywords) {
    // console.warn(
    //   `[${requestId}] Text validation failed: Too short (length ${text.length}) and missing keywords.`
    // );
    return {
      isValid: false,
      error: `Input does not appear to be a valid recipe (too short and missing keywords).`,
    };
  }

  if (text.length < minLength) {
    // console.warn(
    //   `[${requestId}] Text validation failed: Too short (length ${text.length}).`
    // );
    return {
      isValid: false,
      error: `Input is too short (length ${text.length}) to likely be a recipe.`,
    };
  }

  if (!hasKeywords) {
    // console.warn(
    //   `[${requestId}] Text validation failed: Missing common recipe keywords.`
    // );
    return {
      isValid: false,
      error: "Input is missing common recipe keywords (e.g., ingredients, instructions).",
    };
  }

  // Add more checks if needed, e.g., very repetitive content, etc.

  return { isValid: true };
} 