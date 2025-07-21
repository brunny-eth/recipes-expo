import { Content } from "@google/generative-ai";

export interface ChatContext {
  instructions: string[];
  substitutions?: string | null;
}

/**
 * Builds the system prompt for AI chat with optional recipe context.
 * Creates a conversational, helpful cooking assistant that can reference
 * the current recipe when relevant but isn't limited to it.
 */
export function buildChatSystemPrompt(recipeContext?: ChatContext): Content[] {
  const basePrompt = `You are a friendly, smart cooking assistant that helps users while they cook. You're concise, clear, and great at explaining cooking techniques and helping troubleshoot.`;

  if (!recipeContext) {
    return [{ role: "user", parts: [{ text: basePrompt }] }];
  }

  let contextText = basePrompt + "\n\n";
  contextText += "The user is currently cooking this recipe:\n\n";
  contextText += "Instructions:\n";
  recipeContext.instructions.forEach((step: string, index: number) => {
    contextText += `${index + 1}. ${step}\n`;
  });
  
  if (recipeContext.substitutions) {
    contextText += `\nNotes on substitutions: ${recipeContext.substitutions}\n`;
  }
  
  contextText += "\nYou can refer to this recipe as needed, but also feel free to answer general cooking questions.";

  return [{ role: "user", parts: [{ text: contextText }] }];
}

/**
 * Alternative system prompt for more general cooking assistance
 * when no specific recipe context is available.
 */
export function buildGeneralCookingPrompt(): Content[] {
  return [{
    role: "user", 
    parts: [{ 
      text: `You are a friendly, smart cooking assistant that helps users with cooking questions and techniques. You're concise, clear, and great at explaining cooking concepts, troubleshooting, and providing helpful tips.` 
    }]
  }];
} 