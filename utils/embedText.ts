import OpenAI from 'openai'

// This function should only be used in a client-side context.
// Always use the EXPO_PUBLIC_ prefixed variable.
const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!openaiApiKey) {
  // We don't throw an error here, as this file might be imported in contexts
  // where the key isn't immediately needed. The calling function should handle the error.
  console.warn("EXPO_PUBLIC_OPENAI_API_KEY is not set. Text embedding will fail.");
}

const openai = new OpenAI({ 
  apiKey: openaiApiKey,
  dangerouslyAllowBrowser: true // Necessary for client-side usage
});

export const embedText = async (text: string): Promise<number[]> => {
  if (!openaiApiKey) {
    throw new Error("OpenAI API key is not configured. Cannot embed text.");
  }
  const input = text.slice(0, 8192) // just in case

  console.log('[DEBUG] Embedding input length:', input.length)

  const res = await openai.embeddings.create({
    input,
    model: 'text-embedding-3-large',
  })

  console.log('[DEBUG] Embedding response:', res)

  const embedding = res.data[0]?.embedding

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Invalid embedding returned')
  }

  return embedding
}