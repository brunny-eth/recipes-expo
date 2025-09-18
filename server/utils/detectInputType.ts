export type InputType = 'url' | 'raw_text' | 'image' | 'video' | 'invalid';

export interface RawTextHeuristicsResult {
  hasIngredients: boolean;
  hasInstructions: boolean;
  hasQuantities: boolean;
  confidence: number; // 0-1 scale of how likely this is raw recipe text
  reasoning: string[];
}

/**
 * Analyzes raw text to determine if it contains recipe-like content
 * Looks for ingredients, instructions, and quantities to distinguish from simple dish names
 */
export function analyzeRawTextHeuristics(input: string): RawTextHeuristicsResult {
  const trimmed = input.trim();
  const reasoning: string[] = [];

  // Ingredient patterns (common ingredient words)
  const ingredientKeywords = [
    'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'onion', 'garlic', 'tomato',
    'potato', 'carrot', 'pepper', 'salt', 'sugar', 'flour', 'butter', 'oil', 'milk', 'cheese',
    'egg', 'bread', 'rice', 'pasta', 'olive', 'vinegar', 'soy', 'cumin', 'paprika', 'oregano',
    'basil', 'thyme', 'rosemary', 'sage', 'parsley', 'cilantro', 'ginger', 'lemon', 'lime',
    'orange', 'apple', 'banana', 'strawberry', 'blueberry', 'spinach', 'lettuce', 'broccoli',
    'cauliflower', 'mushroom', 'zucchini', 'cucumber', 'avocado', 'almond', 'walnut', 'peanut'
  ];

  // Instruction patterns (cooking verbs)
  const instructionKeywords = [
    'cook', 'bake', 'fry', 'grill', 'roast', 'boil', 'steam', 'sauté', 'stir', 'mix', 'chop',
    'dice', 'slice', 'mince', 'grate', 'whisk', 'beat', 'knead', 'roll', 'cut', 'peel', 'heat',
    'simmer', 'reduce', 'season', 'marinate', 'preheat', 'cool', 'chill', 'serve', 'garnish'
  ];

  // Quantity patterns (numbers, fractions, measurements)
  const quantityPatterns = [
    /\b\d+\/\d+\b/g, // fractions like 1/2, 3/4
    /\b\d+(\.\d+)?\s*(cup|cups|tbsp|tsp|oz|lb|pound|gram|g|ml|l|liter|teaspoon|tablespoon|ounce|pint|quart|gallon)\b/gi,
    /\b\d+(\.\d+)?\s*(whole|large|medium|small|clove|cloves|slice|slices|piece|pieces|can|cans|package|packages|bag|bags)\b/gi,
    /\b\d+\b/g // simple numbers
  ];

  // Check for ingredients
  const ingredientMatches = ingredientKeywords.filter(keyword =>
    trimmed.toLowerCase().includes(keyword.toLowerCase())
  );
  const hasIngredients = ingredientMatches.length > 0;
  if (hasIngredients) {
    reasoning.push(`Found ${ingredientMatches.length} ingredient keywords: ${ingredientMatches.slice(0, 3).join(', ')}${ingredientMatches.length > 3 ? '...' : ''}`);
  }

  // Check for instructions
  const instructionMatches = instructionKeywords.filter(keyword =>
    trimmed.toLowerCase().includes(keyword.toLowerCase())
  );
  const hasInstructions = instructionMatches.length > 0;
  if (hasInstructions) {
    reasoning.push(`Found ${instructionMatches.length} instruction keywords: ${instructionMatches.slice(0, 3).join(', ')}${instructionMatches.length > 3 ? '...' : ''}`);
  }

  // Check for quantities
  let quantityMatches = 0;
  quantityPatterns.forEach(pattern => {
    const matches = trimmed.match(pattern);
    if (matches) {
      quantityMatches += matches.length;
    }
  });
  const hasQuantities = quantityMatches > 0;
  if (hasQuantities) {
    reasoning.push(`Found ${quantityMatches} quantity patterns`);
  }

  // Calculate confidence score
  let confidence = 0;
  if (hasIngredients) confidence += 0.4;
  if (hasInstructions) confidence += 0.4;
  if (hasQuantities) confidence += 0.2;

  // Boost confidence for longer text (raw recipes tend to be longer than dish names)
  if (trimmed.length > 100) confidence += 0.1;
  if (trimmed.length > 200) confidence += 0.1;

  // Penalize very short text (likely just a dish name)
  if (trimmed.length < 20) confidence -= 0.2;

  // Cap at 1.0
  confidence = Math.min(confidence, 1.0);
  confidence = Math.max(confidence, 0);

  if (!hasIngredients && !hasInstructions && !hasQuantities) {
    reasoning.push('No recipe-like content detected - appears to be a simple dish name');
  }

  return {
    hasIngredients,
    hasInstructions,
    hasQuantities,
    confidence,
    reasoning
  };
}

/**
 * Validates input specifically for raw text mode
 * Ensures the text contains recipe-like content (ingredients, instructions, quantities)
 */
export function validateRawTextInput(input: string): { isValid: boolean; error?: string; heuristics?: RawTextHeuristicsResult } {
  const trimmed = input.trim();

  // Basic validation first
  if (!trimmed) {
    return { isValid: false, error: 'Please enter some recipe text.' };
  }

  if (trimmed.length < 10) {
    return { isValid: false, error: 'Please provide more recipe text or ingredients to parse.' };
  }

  // Check if it looks like a URL (should use URL mode instead)
  const inputType = detectInputType(trimmed);
  if (inputType === 'url' || inputType === 'video') {
    return { isValid: false, error: 'This looks like a URL. Please use the Website input mode instead.' };
  }

  // Analyze heuristics for recipe-like content
  const heuristics = analyzeRawTextHeuristics(trimmed);

  // Require minimum confidence for raw text
  if (heuristics.confidence < 0.3) {
    return {
      isValid: false,
      error: 'This doesn\'t look like recipe text. Try pasting the full recipe content or entering a dish name in the Dish Name field.',
      heuristics
    };
  }

  return { isValid: true, heuristics };
}

/**
 * Validates input specifically for dish name mode
 * Allows simple dish names but prevents URLs and enforces basic text requirements
 */
export function validateDishNameInput(input: string): { isValid: boolean; error?: string } {
  const trimmed = input.trim();

  // Basic validation first
  if (!trimmed) {
    return { isValid: false, error: 'Please enter a dish name.' };
  }

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Please be a bit more descriptive about the dish you want to cook.' };
  }

  // Check if it looks like a URL (should use URL mode instead)
  const inputType = detectInputType(trimmed);
  if (inputType === 'url' || inputType === 'video') {
    return { isValid: false, error: 'This looks like a URL. Please use the Website input mode instead.' };
  }

  // For dish names, we want simple text - check that it's not too complex (which might indicate raw recipe text)
  const heuristics = analyzeRawTextHeuristics(trimmed);

  // If confidence is too high, this might be raw recipe text that should use the raw text mode
  if (heuristics.confidence > 0.7) {
    return {
      isValid: false,
      error: 'This looks like full recipe text. Please use the Raw Text input mode instead.'
    };
  }

  return { isValid: true };
}

/**
 * Detects if the input string is likely a URL, raw text, or invalid input.
 * @param input The input string.
 * @returns 'url' if it looks like a URL, 'raw_text' if it's valid text, or 'invalid' if it's empty, whitespace-only, or meaningless.
 */
export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  // Input classification starting

  // Handle empty or purely whitespace inputs
  if (trimmed === '') {
    // Empty input classified as invalid
    return 'invalid';
  }

  // Loosen minimum length requirement - allow shorter inputs like "lasagna", "pasta"
  if (trimmed.length < 3) {
    // Input too short, classified as invalid
    return 'invalid';
  }

  // First, check if this looks like a URL - URLs should be validated by URL parsing, not letter ratio
  // Attempt to create a URL object. This is the most reliable way to validate a URL.
  // Prepend 'https://' if no protocol is present, to help the URL constructor.
  let potentialUrl = trimmed;
  if (!potentialUrl.match(/^https?:\/\//i)) {
      potentialUrl = 'https://' + potentialUrl;
  }

  try {
      const urlObj = new URL(potentialUrl);

      // A simple, yet effective, check for a valid domain:
      // - It must contain at least one dot in the hostname (e.g., example.com)
      // - All parts separated by dots must have some length (e.g., not 'a..b')
      // - It must have either a path (after /) or query parameters (after ?)
      // This helps filter out hostnames like 'invalid' or 'localhost' from being treated as remote URLs.
      if (urlObj.hostname.includes('.') && urlObj.hostname.split('.').every(part => part.length > 0)) {
          // Additional validation: must have a path or query parameters
          const hasPath = urlObj.pathname && urlObj.pathname.length > 1; // More than just "/"
          const hasQuery = urlObj.search && urlObj.search.length > 0; // Has query parameters
          const hasFragment = urlObj.hash && urlObj.hash.length > 0; // Has fragment

          if (!hasPath && !hasQuery && !hasFragment) {
              // Bare domain without path, classified as invalid
              return 'invalid';
          }

          // Check if this is a video URL from supported platforms
          const videoPatterns = [
            /^(www\.)?(youtube\.com|youtu\.be)/i,
            /^(www\.)?(instagram\.com)/i,
            /^(www\.)?(tiktok\.com)/i
          ];

          const isVideoUrl = videoPatterns.some(pattern => pattern.test(urlObj.hostname));

          if (isVideoUrl) {
              // Video URL detected
              return 'video';
          } else {
              // Valid URL with proper domain and path
              return 'url';
          }
      } else {
          // If it has a protocol but the hostname doesn't look like a valid FQDN
          // (e.g., "https://invalid", "http://mylocalhost"), treat it as raw_text since it's likely a recipe name
          // Invalid domain, likely recipe name - classified as raw_text
          return 'raw_text';
      }
  } catch (e) {
      // If the URL constructor throws an error, the string is not a valid URL.
      // Now check if it's valid text using letter ratio
      const errorMessage = e instanceof Error ? e.message : String(e);
      // URL parsing failed, checking text classification
  }

  // If it's not a valid URL, apply letter ratio check for text inputs
  // This allows inputs like "lasagna", "pasta", "curry", "7-layer dip" while rejecting pure numbers
  const letterRatio = (trimmed.match(/[a-zA-Z]/g) || []).length / trimmed.length;
  if (letterRatio < 0.65) {
    // Insufficient letters, classified as invalid
    return 'invalid';
  }

  // If it passed the letter ratio test but isn't a URL, it's raw text
  // Valid text input classified as raw_text
  return 'raw_text';
} 