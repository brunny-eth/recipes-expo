import { Router, Request, Response } from 'express';
import logger from '../lib/logger';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content } from "@google/generative-ai";
import OpenAI from 'openai';

// Initialize the Google AI client using the secure, backend-only environment variable.
const googleApiKey = process.env.GOOGLE_API_KEY;
if (!googleApiKey) {
  logger.error({ context: 'AI_ROUTE_INIT' }, 'GOOGLE_API_KEY environment variable is not set!');
  // We don't throw an error here, but the chat endpoint will fail gracefully if called.
}
const genAI = new GoogleGenerativeAI(googleApiKey || '');

// --- OpenAI Client ---
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  logger.error({ context: 'AI_ROUTE_INIT' }, 'OPENAI_API_KEY environment variable is not set!');
}
const openai = new OpenAI({ apiKey: openaiApiKey });

const router = Router();

// --- Gemini Chat Endpoint ---
router.post('/chat', async (req: Request, res: Response) => {
  const { userMessage, history, recipeContext } = req.body;
  const requestId = (req as any).id;

  logger.info({ requestId, route: '/api/ai/chat' }, 'Received request for Gemini chat.');

  if (!googleApiKey) {
    logger.error({ requestId }, 'Attempted to use /api/ai/chat but GOOGLE_API_KEY is not configured on the server.');
    return res.status(500).json({ error: 'AI service is not configured on the server.' });
  }

  if (!userMessage || !Array.isArray(history)) {
    logger.warn({ requestId }, 'Invalid request body received for /chat.');
    return res.status(400).json({ error: 'Invalid request: "userMessage" and "history" are required.' });
  }
  
  try {
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];
    
    let historyForApi: Content[] = [...history];
    let promptForApi = userMessage;

    if (history.length === 0 && recipeContext) {
        let contextText = "You are a friendly and helpful recipe assistant. \n";
        contextText += "The user is currently working on the following recipe:\n\n";
        contextText += "Instructions:\n";
        recipeContext.instructions.forEach((step: string, index: number) => {
            contextText += `${index + 1}. ${step}\n`;
        });
        if (recipeContext.substitutions) {
            contextText += `\nNotes on substitutions: ${recipeContext.substitutions}\n`;
        }
        contextText += "\n--- END OF RECIPE CONTEXT ---\n\n";
        contextText += "Now, please answer the user's question about this recipe. Be concise and helpful.\n";

        historyForApi = [{ role: "user", parts: [{ text: contextText }] }];
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp", safetySettings });
    const chat = model.startChat({ history: historyForApi });
    
    const result = await chat.sendMessage(promptForApi);
    const response = result.response;
    const text = response.text();

    res.json({ response: text });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, error: error.message, stack: error.stack }, 'Error calling Gemini API from backend.');
    if (error.message.includes("SAFETY")) {
        return res.status(400).json({ error: "Sorry, your request was blocked due to safety settings. Please rephrase your question." });
    }
    res.status(500).json({ error: "An error occurred while communicating with the AI service." });
  }
});

// --- OpenAI Chat Endpoint ---
router.post('/openai-chat', async (req: Request, res: Response) => {
  const { messages } = req.body;
  const requestId = (req as any).id;

  logger.info({ requestId, route: '/api/ai/openai-chat' }, 'Received request for OpenAI chat.');

  if (!openaiApiKey) {
    logger.error({ requestId }, 'Attempted to use /api/ai/openai-chat but OPENAI_API_KEY is not configured on the server.');
    return res.status(500).json({ error: 'AI service is not configured on the server.' });
  }

  if (!messages || !Array.isArray(messages)) {
    logger.warn({ requestId }, 'Invalid request body received for /openai-chat.');
    return res.status(400).json({ error: 'Invalid request: "messages" array is required.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: messages as any, // Cast to any to match expected type
    });

    res.json({ response: completion.choices[0].message.content });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, error: error.message, stack: error.stack }, 'Error calling OpenAI API from backend.');
    res.status(500).json({ error: "An error occurred while communicating with the OpenAI service." });
  }
});

// --- OpenAI Embedding Endpoint ---
router.post('/embed', async (req: Request, res: Response) => {
  const { text } = req.body;
  const requestId = (req as any).id;

  logger.info({ requestId, route: '/api/ai/embed' }, 'Received request for text embedding.');

  if (!openaiApiKey) {
    logger.error({ requestId }, 'Attempted to use /api/ai/embed but OPENAI_API_KEY is not configured on the server.');
    return res.status(500).json({ error: 'AI service is not configured on the server.' });
  }

  if (!text || typeof text !== 'string') {
    logger.warn({ requestId }, 'Invalid request body received for /embed.');
    return res.status(400).json({ error: 'Invalid request: "text" is required and must be a string.' });
  }

  try {
    const input = text.slice(0, 8192); // Truncate to max length
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-large",
        input: input,
        encoding_format: "float",
    });
    
    res.json({ embedding: embeddingResponse.data[0].embedding });

  } catch (err) {
    const error = err as Error;
    logger.error({ requestId, error: error.message, stack: error.stack }, 'Error calling OpenAI Embedding API from backend.');
    res.status(500).json({ error: "An error occurred while creating the text embedding." });
  }
});

export const aiRouter = router; 