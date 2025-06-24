import { sendMessageToGemini } from './geminiApi';
import OpenAI from 'openai';

// This function should only be used in a client-side context.
// Always use the EXPO_PUBLIC_ prefixed variable.
const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn("EXPO_PUBLIC_OPENAI_API_KEY is not set. AI Chat features will be disabled.");
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true // Necessary for client-side usage
});

export async function sendMessageWithFallback(
  userMessage: string,
  history: any[],
  recipeContext?: { instructions: string[]; substitutions?: string | null }
): Promise<string | null> {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  // First try Gemini
  try {
    const response = await sendMessageToGemini(userMessage, history, recipeContext);

    // If we got a valid, non-error response from Gemini, just return it.
    if (response && !/^error[:\s]/i.test(response.trim())) {
      return response;
    }

    // Otherwise, log and continue to fallback.
    console.warn('Gemini chat responded with error, attempting OpenAI fallback:', response);
  } catch (err) {
    console.warn('Gemini chat threw exception, attempting OpenAI fallback:', err);
  }

  // Fallback to OpenAI if available
  if (!openai) {
    console.error('OpenAI API key missing; cannot fallback.');
    return null;
  }

  try {
    // Build OpenAI chat history preserving prior turns if provided
    const openAiMessages = [
      ...history.map((h) => ({ role: h.role, content: h.parts?.[0]?.text || '' })),
      { role: 'user', content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openAiMessages,
    });
    return completion.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('OpenAI chat error:', err);
    return null;
  }
} 