import OpenAI from 'openai';
import logger from './logger';

// Initialize OpenAI client
const openaiApiKey = process.env.OPENAI_API_KEY;
let openai: OpenAI | null = null;

if (openaiApiKey) {
  openai = new OpenAI({
    apiKey: openaiApiKey
  });
} else {
  logger.error({ context: 'init', missingKey: 'OPENAI_API_KEY', nodeEnv: process.env.NODE_ENV }, 'OPENAI_API_KEY environment variable is not set!');
}

export default openai; 