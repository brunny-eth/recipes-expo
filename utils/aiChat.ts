import { sendMessageToGemini } from './geminiApi';
import OpenAI from 'openai';

// Allow OpenAI usage in React Native / Browser via fetch
const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (openaiApiKey) {
  // @ts-ignore - browser flag
  openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
}

export async function sendMessageWithFallback(
  userMessage: string,
  history: any[],
  recipeContext?: { instructions: string[]; substitutions?: string | null }
): Promise<string | null> {
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