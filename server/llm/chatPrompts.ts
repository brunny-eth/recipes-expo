import { Content } from "@google/generative-ai";

export interface ChatContext {
  instructions: string[];
  substitutions?: string | null;
}

/**
 * Builds the system prompt for AI chat with recipe context.
 * Creates a conversational, helpful cooking assistant that can reference
 * the current recipe when relevant but isn't limited to it.
 */
export function buildChatSystemPrompt(recipeContext: ChatContext): Content[] {
  const basePrompt = `You are a friendly, smart cooking assistant that helps users while they cook. You're concise, clear, and great at explaining cooking techniques and helping troubleshoot.

CRITICAL RULES:
1. Keep your responses under 75 characters total
2. NEVER use markdown formatting like **bold**, *italic*, bullet points, or any special characters
3. Write ONLY in plain text with no formatting whatsoever
4. Do not use asterisks, dashes, or any decorative characters`;

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