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

  console.log('[stepUtils] 🧪 Testing improved ingredient highlighting:');
  
  const searchTerms = generateIngredientSearchTerms(testIngredients);
  const uniqueTerms = getUniqueSearchTermItems(searchTerms);
  
  console.log('Generated search terms:', uniqueTerms.map(t => t.searchTerm));
  
  testSteps.forEach((step, index) => {
    console.log(`\nStep ${index + 1}: "${step}"`);
    const regex = new RegExp(`(${uniqueTerms.map(item => item.searchTerm).join('|')})`, 'gi');
    const parts = step.split(regex);
    console.log('Split parts:', parts.filter(part => part));
  });
};

// Debug function to help visualize generated search terms
export const debugIngredientSearchTerms = (ingredients: StructuredIngredient[]) => {
  const searchTerms = generateIngredientSearchTerms(ingredients);
  console.log('[stepUtils] 🔍 Generated search terms:');
  ingredients.forEach((ing, index) => {
    const termsForIngredient = searchTerms.filter(item => item.ingredient === ing);
    console.log(`  ${index + 1}. "${ing.name}" → [${termsForIngredient.map(t => `"${t.searchTerm}"`).join(', ')}]`);
  });
  return searchTerms;
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

// Step completion actions
export const createStepCompletionToggler = (
  onStepToggle: (stepIndex: number, isCompleted: boolean) => void
) => {
  return (stepIndex: number, currentCompletedSteps: StepCompletionState) => {
    const isCurrentlyCompleted = currentCompletedSteps[stepIndex];
    onStepToggle(stepIndex, !isCurrentlyCompleted);
  };
}; 