import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from "@google/generative-ai";
import OpenAI from 'openai';
import logger from './logger';

// --- Model Initialization ---

const googleApiKey = process.env.GOOGLE_API_KEY;
export let geminiModel: ReturnType<InstanceType<typeof GoogleGenerativeAI>["getGenerativeModel"]> | null = null;
if (!googleApiKey) {
  logger.error({ context: "init", missingKey: "GOOGLE_API_KEY", nodeEnv: process.env.NODE_ENV }, "GOOGLE_API_KEY environment variable is not set!");
} else {
  try {
    const genAI = new GoogleGenerativeAI(googleApiKey);
    const geminiConfig: GenerationConfig = {
      responseMimeType: "application/json",
      temperature: 0.1,
    };
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];
    geminiModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: geminiConfig,
      safetySettings,
    });
  } catch (e) {
    logger.error({ context: "init", error: e, message: (e as Error).message, stack: (e as Error).stack }, "❌ Failed to initialize Gemini model");
  }
}

const openaiApiKey = process.env.OPENAI_API_KEY;
export let openai: OpenAI | null = null;
if (openaiApiKey) {
  openai = new OpenAI({ apiKey: openaiApiKey });
} else {
  logger.error({ context: 'init', missingKey: 'OPENAI_API_KEY', nodeEnv: process.env.NODE_ENV }, 'OPENAI_API_KEY environment variable is not set!');
} 