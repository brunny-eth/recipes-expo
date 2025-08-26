import { StructuredIngredient } from '@/common/types';

// Step completion logic
export interface StepCompletionState {
  [key: number]: boolean;
}

export const getFirstUncompletedStepIndex = (
  instructions: string[],
  completedSteps: StepCompletionState
): number => {
  const firstUncompletedIndex = instructions.findIndex(
    (_, index) => !completedSteps[index]
  );
  return firstUncompletedIndex === -1 ? -1 : firstUncompletedIndex;
};

export const calculateProgressPercentage = (
  instructions: string[],
  completedSteps: StepCompletionState
): number => {
  const completedStepsCount = Object.values(completedSteps).filter(Boolean).length;
  return instructions.length > 0 ? (completedStepsCount / instructions.length) * 100 : 0;
};

export const isStepCompleted = (
  stepIndex: number,
  completedSteps: StepCompletionState
): boolean => {
  return !!completedSteps[stepIndex];
};

export const isStepActive = (
  stepIndex: number,
  instructions: string[],
  completedSteps: StepCompletionState
): boolean => {
  const firstUncompletedIndex = getFirstUncompletedStepIndex(instructions, completedSteps);
  return stepIndex === firstUncompletedIndex;
};

// Auto-scroll logic
export const autoScrollToNextStep = (
  currentStepIndex: number,
  instructions: string[],
  completedSteps: StepCompletionState,
  scrollViewRef: React.RefObject<any>,
  delay: number = 200
): void => {
  setTimeout(() => {
    const nextUncompletedIndex = instructions.findIndex(
      (_, stepIndex) => stepIndex > currentStepIndex && !completedSteps[stepIndex]
    );
    
    if (nextUncompletedIndex !== -1 && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: nextUncompletedIndex * 100, // Approximate height per step
        animated: true,
      });
    }
  }, delay);
};

// Test function to demonstrate the improved logic
export const testIngredientHighlighting = () => {
  const testIngredients = [
    { name: 'Extra Virgin Olive Oil' },
    { name: 'Chili Flakes' },
    { name: 'Honey' },
    { name: 'Garlic Powder' },
  ] as StructuredIngredient[];

  const testSteps = [
    'Add extra virgin olive oil to the pan',
    'Sprinkle chili flakes on top',
    'Drizzle with honey and chili flakes',
    'Mix in garlic powder and salt',
  ];

  const searchTerms = generateIngredientSearchTerms(testIngredients);
  const uniqueTerms = getUniqueSearchTermItems(searchTerms);
  
  testSteps.forEach((step, index) => {
    const regex = new RegExp(`(${uniqueTerms.map(item => item.searchTerm).join('|')})`, 'gi');
    const parts = step.split(regex);
    // Console logs removed for cleaner output
  });
};

// Debug function to help visualize generated search terms
export const debugIngredientSearchTerms = (ingredients: StructuredIngredient[]) => {
  const searchTerms = generateIngredientSearchTerms(ingredients);
  // Console logs removed for cleaner output
  return searchTerms;
};

// Debug function for smart highlighting
export const debugSmartHighlighting = (
  text: string,
  ingredients: StructuredIngredient[]
) => {
  console.log('[DEBUG] Smart highlighting for text:', text);
  console.log('[DEBUG] Ingredients:', ingredients.map(ing => ing.name));
  
  const spans = findIngredientSpans(text, ingredients);
  console.log('[DEBUG] Found spans:', spans);
  
  const segments = parseTextSegments(text, spans);
  console.log('[DEBUG] Text segments:', segments);
  
  return { spans, segments };
};

// Ingredient highlighting logic
export const escapeRegex = (string: string): string => {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

export const generateIngredientSearchTerms = (ingredients: StructuredIngredient[]) => {
  return ingredients
    .flatMap((ing) => {
      const baseName = ing.name.split(' (substituted for')[0].trim();
      if (!baseName) return [];

      const terms = new Set<string>();
      
      // 1. Always add the full base name as the highest priority term
      terms.add(baseName);

      // 2. Generate meaningful sub-phrases for multi-word ingredients
      const words = baseName.split(' ');
      if (words.length > 1) {
        // Add common ingredient sub-phrases (e.g., "Olive Oil" from "Extra Virgin Olive Oil")
        // Start with the last 2 words, then last 3, etc. to capture meaningful combinations
        for (let i = 2; i <= Math.min(words.length, 4); i++) {
          const subPhrase = words.slice(-i).join(' ');
          if (subPhrase.length > 3) {
            terms.add(subPhrase);
          }
        }
        
        // Add individual meaningful words (longer than 3 characters)
        words.forEach((word) => {
          if (word.length > 3) {
            terms.add(word);
          }
        });
      } else {
        // Single word ingredients - just add the word
        terms.add(baseName);
      }

      // 3. Handle singular/plural variations
      const finalTerms = new Set<string>(terms);
      terms.forEach((term) => {
        const lowerTerm = term.toLowerCase();
        if (lowerTerm.endsWith('s')) {
          finalTerms.add(term.slice(0, -1));
        } else {
          if (!term.includes(' ')) {
            finalTerms.add(term + 's');
          }
        }
      });

      return Array.from(finalTerms).map((term) => ({
        ingredient: ing,
        searchTerm: `\\b${escapeRegex(term)}\\b`, // Use word boundaries for precise matching
      }));
    })
    .filter((item) => item.searchTerm);
};

export const getUniqueSearchTermItems = (searchTermsWithIng: Array<{ ingredient: StructuredIngredient; searchTerm: string }>) => {
  const uniqueSearchTermItems = Array.from(
    new Map(
      searchTermsWithIng.map((item) => [item.searchTerm.toLowerCase(), item])
    ).values()
  );
  uniqueSearchTermItems.sort(
    (a, b) => b.searchTerm.length - a.searchTerm.length
  );
  return uniqueSearchTermItems;
};

// Smart ingredient highlighting system
export interface IngredientSpan {
  start: number;
  end: number;
  ingredientId: string;
  occurrenceIndex: number;
  searchTerm: string;
}

export interface TextSegment {
  text: string;
  isHighlighted: boolean;
  ingredientId?: string;
  searchTerm?: string;
}

// Whitelist of safe single-word ingredients that can be highlighted
const SAFE_SINGLE_WORD_INGREDIENTS = new Set([
  'garlic', 'cumin', 'paprika', 'salt', 'pepper', 'sugar', 'flour', 'butter',
  'eggs', 'milk', 'cream', 'cheese', 'bread', 'rice', 'pasta', 'meat',
  'fish', 'chicken', 'beef', 'pork', 'lamb', 'shrimp', 'salmon', 'tuna',
  'onion', 'carrot', 'celery', 'tomato', 'potato', 'lemon', 'lime', 'orange',
  'apple', 'banana', 'strawberry', 'blueberry', 'raspberry', 'blackberry',
  'basil', 'oregano', 'thyme', 'rosemary', 'sage', 'mint', 'parsley', 'cilantro',
  'ginger', 'turmeric', 'cinnamon', 'nutmeg', 'cloves', 'cardamom', 'vanilla',
  'chocolate', 'cocoa', 'honey', 'syrup', 'vinegar', 'soy', 'mustard', 'ketchup',
  'orzo', 'penne', 'spaghetti', 'linguine', 'fettuccine', 'rigatoni', 'ziti',
  'couscous', 'quinoa', 'bulgur', 'barley', 'oatmeal', 'cornmeal', 'semolina',
  'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia',
  'raisin', 'cranberry', 'apricot', 'prune', 'date', 'fig', 'currant',
  'cucumber', 'zucchini', 'eggplant', 'bell pepper', 'jalapeño', 'serrano',
  'mushroom', 'spinach', 'kale', 'lettuce', 'arugula', 'watercress', 'endive',
  'asparagus', 'broccoli', 'cauliflower', 'brussels sprouts', 'cabbage', 'kohlrabi',
  'turnip', 'rutabaga', 'parsnip', 'beet', 'radish', 'daikon', 'horseradish',
  'scallion', 'shallot', 'leek', 'chive', 'garlic powder', 'onion powder',
  'bay leaf', 'tarragon', 'marjoram', 'chervil', 'dill', 'fennel', 'caraway',
  'allspice', 'star anise', 'saffron', 'sumac', 'za\'atar', 'harissa', 'curry',
  'chili powder', 'cayenne', 'red pepper flakes', 'black pepper', 'white pepper',
  'sea salt', 'kosher salt', 'flaky salt', 'himalayan salt', 'celtic salt',
  'balsamic vinegar', 'red wine vinegar', 'white wine vinegar', 'apple cider vinegar',
  'rice vinegar', 'sherry vinegar', 'champagne vinegar', 'malt vinegar',
  'sesame oil', 'avocado oil', 'coconut oil', 'grapeseed oil', 'sunflower oil',
  'canola oil', 'vegetable oil', 'peanut oil', 'walnut oil', 'hazelnut oil',
  'parmesan', 'chives', 'peanuts'
]);

// Stoplist of common descriptors that should never match alone
const STOPLIST_DESCRIPTORS = new Set([
  'extra', 'virgin', 'oil', 'fresh', 'chopped', 'large', 'small', 'diced', 'sliced',
  'minced', 'grated', 'crushed', 'ground', 'whole', 'dried', 'frozen', 'canned',
  'organic', 'natural', 'pure', 'refined', 'unrefined', 'cold', 'hot', 'warm',
  'soft', 'hard', 'ripe', 'unripe', 'sweet', 'sour', 'bitter', 'spicy', 'mild'
]);

// Normalize text for matching (lowercase + strip diacritics)
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .trim();
};

// Check if a word is a safe single-word ingredient
const isSafeSingleWord = (word: string): boolean => {
  const normalized = normalizeText(word);
  return SAFE_SINGLE_WORD_INGREDIENTS.has(normalized);
};

// Check if a word is a stoplisted descriptor
const isStoplisted = (word: string): boolean => {
  const normalized = normalizeText(word);
  return STOPLIST_DESCRIPTORS.has(normalized);
};

// Generate smart aliases for an ingredient
const generateSmartAliases = (ingredientName: string): string[] => {
  const aliases = new Set<string>();
  const words = ingredientName.split(' ').filter(word => word.trim());
  
  if (words.length === 0) return [];
  
  // Always add the full name as highest priority
  aliases.add(ingredientName);
  
  if (words.length === 1) {
    // Single word - only add if it's safe
    if (isSafeSingleWord(words[0])) {
      aliases.add(words[0]);
    }
  } else {
    // Multi-word ingredients - generate meaningful sub-phrases
    
    // Add combinations from the end (most specific to least specific)
    for (let i = 2; i <= Math.min(words.length, 4); i++) {
      const subPhrase = words.slice(-i).join(' ');
      if (subPhrase.length > 3) {
        aliases.add(subPhrase);
      }
    }
    
    // For multi-word ingredients, also add the last two words as a common pattern
    if (words.length >= 2) {
      const lastTwo = words.slice(-2).join(' ');
      if (lastTwo.length > 3) {
        aliases.add(lastTwo);
      }
    }
    
    // Add individual words only if they're safe and not stoplisted
    words.forEach(word => {
      if (word.length > 3 && isSafeSingleWord(word) && !isStoplisted(word)) {
        aliases.add(word);
      }
    });
  }
  
  // Handle singular/plural variations for multi-word phrases
  const finalAliases = new Set<string>(aliases);
  aliases.forEach(alias => {
    if (alias.includes(' ')) {
      const words = alias.split(' ');
      const lastWord = words[words.length - 1];
      
      if (lastWord.endsWith('s')) {
        const singular = words.slice(0, -1).concat(lastWord.slice(0, -1)).join(' ');
        finalAliases.add(singular);
      } else {
        const plural = alias + 's';
        finalAliases.add(plural);
      }
    }
  });
  
  return Array.from(finalAliases);
};

// Find all non-overlapping ingredient spans in text
export const findIngredientSpans = (
  text: string,
  ingredients: StructuredIngredient[]
): IngredientSpan[] => {
  const spans: IngredientSpan[] = [];
  const textLower = normalizeText(text);
  
  ingredients.forEach((ingredient, ingredientIndex) => {
    const aliases = generateSmartAliases(ingredient.name);
    
    // Sort aliases by length (longest first) to prioritize longer matches
    aliases.sort((a, b) => b.length - a.length);
    
    aliases.forEach(alias => {
      const normalizedAlias = normalizeText(alias);
      let startIndex = 0;
      let occurrenceIndex = 0;
      
      while (true) {
        const index = textLower.indexOf(normalizedAlias, startIndex);
        if (index === -1) break;
        
        // Check token boundaries (letters, numbers, hyphens, apostrophes)
        const beforeChar = index > 0 ? text[index - 1] : '';
        const afterChar = index + normalizedAlias.length < text.length ? text[index + normalizedAlias.length] : '';
        
        // More flexible boundary checking for cooking context
        const isTokenBoundaryBefore = !/[a-zA-Z0-9\-']/.test(beforeChar) || beforeChar === ' ';
        const isTokenBoundaryAfter = !/[a-zA-Z0-9\-']/.test(afterChar) || afterChar === ' ';
        
        // Special case: allow matching at the beginning of text
        const isAtStart = index === 0;
        const isAtEnd = index + normalizedAlias.length >= text.length;
        
        if ((isTokenBoundaryBefore || isAtStart) && (isTokenBoundaryAfter || isAtEnd)) {
          // Check for overlaps with existing spans
          const newSpan: IngredientSpan = {
            start: index,
            end: index + normalizedAlias.length,
            ingredientId: ingredient.name, // Use name as ID for now
            occurrenceIndex,
            searchTerm: alias
          };
          
          // Only add if it doesn't overlap with existing spans
          const hasOverlap = spans.some(span => 
            (newSpan.start < span.end && newSpan.end > span.start)
          );
          
          if (!hasOverlap) {
            spans.push(newSpan);
          }
        }
        
        startIndex = index + 1;
        occurrenceIndex++;
      }
    });
  });
  
  // Sort spans by start position
  spans.sort((a, b) => a.start - b.start);
  
  return spans;
};

// Parse text into segments for highlighting
export const parseTextSegments = (
  text: string,
  spans: IngredientSpan[]
): TextSegment[] => {
  if (spans.length === 0) {
    return [{ text, isHighlighted: false }];
  }
  
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  
  spans.forEach((span) => {
    // Add text before the span
    if (span.start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, span.start),
        isHighlighted: false
      });
    }
    
    // Add the highlighted span
    segments.push({
      text: text.slice(span.start, span.end),
      isHighlighted: true,
      ingredientId: span.ingredientId,
      searchTerm: span.searchTerm
    });
    
    lastIndex = span.end;
  });
  
  // Add remaining text after the last span
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isHighlighted: false
    });
  }
  
  return segments;
};

// Render highlighted text with spans
export const renderHighlightedText = (
  text: string,
  segments: TextSegment[],
  onIngredientPress?: (ingredient: StructuredIngredient) => void,
  isCompleted?: boolean
): TextSegment[] => {
  return segments;
};

// Step completion actions
export const createStepCompletionToggler = (
  onStepToggle: (stepIndex: number, isCompleted: boolean) => void
) => {
  return (stepIndex: number, currentCompletedSteps: StepCompletionState) => {
    const isCurrentlyCompleted = currentCompletedSteps[stepIndex];
    onStepToggle(stepIndex, !isCurrentlyCompleted);
  };
}; 