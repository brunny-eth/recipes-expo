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
      terms.add(baseName);

      const words = baseName.split(' ');
      if (words.length > 1) {
        words.forEach((word) => {
          if (word.length > 3) {
            terms.add(word);
          }
        });
      }

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
        searchTerm: `\\b${escapeRegex(term)}\\b`, // Use word boundaries
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