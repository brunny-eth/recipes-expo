import { Content } from "@google/generative-ai";

const backendUrl = process.env.EXPO_PUBLIC_API_URL!;

/**
 * Sends a message to our backend, which then proxies the request to the Gemini API.
 * @param userMessage The message from the user.
 * @param history The conversation history.
 * @param recipeContext Optional recipe context to prepend for the first message.
 * @returns The bot's response text or a formatted error message.
 */
export async function sendMessageToGemini(
  userMessage: string,
  history: Content[],
  recipeContext?: {
    instructions: string[];
    substitutions?: string | null;
  }
): Promise<string | null> {
  if (!backendUrl) {
    const errorMsg = "API URL is not configured. Cannot connect to the backend.";
    console.error(`[sendMessageToGemini] ${errorMsg}`);
    return errorMsg;
  }

  try {
    const response = await fetch(`${backendUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userMessage,
        history,
        recipeContext,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // If the server returned an error (e.g., 400, 500), it will be in data.error
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data.response;

  } catch (error) {
    console.error("Error calling backend AI chat endpoint:", error);
    if (error instanceof Error) {
        return `Sorry, an error occurred: ${error.message}`;
    }
    return "An unknown error occurred while trying to get a response.";
  }
} 