import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function embedText(text: string): Promise<number[]> {
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