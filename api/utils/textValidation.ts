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
      error: "It looks like you haven't entered any text. Please paste a recipe link or just the text.",
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
      error: `This doesn't seem to be a recipe. It's quite short and is missing enough context to be a full recipe. Please try again with a complete recipe.`,
    };
  }

  if (text.length < minLength) {
    // console.warn(
    //   `[${requestId}] Text validation failed: Too short (length ${text.length}).`
    // );
    return {
      isValid: false,
      error: `The recipe seems too short for us to process. Please check if you've pasted the full text.`,
    };
  }

  if (!hasKeywords) {
    // console.warn(
    //   `[${requestId}] Text validation failed: Missing common recipe keywords.`
    // );
    return {
      isValid: false,
      error: "This doesn't seem to be a recipe. It's quite short and is missing enough context to be a full recipe. Please try again with a complete recipe.",
    };
  }

  // Add more checks if needed, e.g., very repetitive content, etc.

  return { isValid: true };
} 