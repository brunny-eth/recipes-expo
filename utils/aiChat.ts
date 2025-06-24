import { sendMessageToGemini } from './geminiApi';

// This function should only be used in a client-side context.
// Always use the EXPO_PUBLIC_ prefixed variable.
const backendUrl = process.env.EXPO_PUBLIC_API_URL!;

if (!backendUrl) {
  console.warn("EXPO_PUBLIC_API_URL is not set. AI Chat features will be disabled.");
}

async function callOpenAIChat(messages: any[]): Promise<string | null> {
  if (!backendUrl) {
    console.error("[aiChat] EXPO_PUBLIC_API_URL is not set.");
    return "Error: API URL not configured.";
  }

  try {
    const response = await fetch(`${backendUrl}/api/ai/openai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    return data.response;
  } catch (error) {
    console.error("[aiChat] Error calling backend OpenAI chat endpoint:", error);
    if (error instanceof Error) {
      return `OpenAI Error: ${error.message}`;
    }
    return "An unknown error occurred while communicating with the OpenAI service.";
  }
}

export async function sendMessageWithFallback(
  userMessage: string,
  history: any[],
  recipeContext?: { instructions: string[]; substitutions?: string | null }
): Promise<string | null> {
  if (!backendUrl) {
    throw new Error("API URL is not configured.");
  }

  // First try Gemini
  try {
    const geminiResponse = await sendMessageToGemini(userMessage, history, recipeContext);

    // If we got a valid, non-error response from Gemini, just return it.
    if (geminiResponse && !geminiResponse.toLowerCase().includes('error')) {
      return geminiResponse;
    }

    // Otherwise, log and continue to fallback.
    console.warn('Gemini chat responded with error, attempting OpenAI fallback:', geminiResponse);
  } catch (geminiError) {
    console.error("Gemini call failed, falling back to OpenAI:", geminiError);
  }

  // Fallback to OpenAI
  console.log("Falling back to OpenAI chat...");
  const openAIHistory = history.map(h => ({ role: h.role, content: h.parts[0].text }));
  const messages = [...openAIHistory, { role: 'user', content: userMessage }];
  return callOpenAIChat(messages);
} 