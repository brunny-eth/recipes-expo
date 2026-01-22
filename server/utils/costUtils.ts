import { StandardizedUsage } from './usageUtils';

// --- Cost Estimation ---

// Based on https://openai.com/pricing/
const GPT_4_TURBO_INPUT_COST_PER_1K_TOKENS = 0.01;
const GPT_4_TURBO_OUTPUT_COST_PER_1K_TOKENS = 0.03;

// Based on https://cloud.google.com/vertex-ai/generative-ai/pricing
// Using Gemini 2.5 Flash rates
const GEMINI_2_5_FLASH_INPUT_COST_PER_1K_TOKENS = 0.0001; // $0.10 per 1M tokens
const GEMINI_2_5_FLASH_OUTPUT_COST_PER_1K_TOKENS = 0.0004; // $0.40 per 1M tokens


/**
 * Estimates the cost of a generative AI model call in USD.
 * @param usage The standardized token usage.
 * @param provider The model provider ('gemini' or 'openai').
 * @returns The estimated cost in USD.
 */
export function estimateCostUSD(usage: StandardizedUsage, provider: 'gemini' | 'openai'): number {
  let inputCost = 0;
  let outputCost = 0;

  if (provider === 'gemini') {
    inputCost = (usage.inputTokens / 1000) * GEMINI_2_5_FLASH_INPUT_COST_PER_1K_TOKENS;
    outputCost = (usage.outputTokens / 1000) * GEMINI_2_5_FLASH_OUTPUT_COST_PER_1K_TOKENS;
  } else if (provider === 'openai') {
    inputCost = (usage.inputTokens / 1000) * GPT_4_TURBO_INPUT_COST_PER_1K_TOKENS;
    outputCost = (usage.outputTokens / 1000) * GPT_4_TURBO_OUTPUT_COST_PER_1K_TOKENS;
  }

  const totalCost = inputCost + outputCost;
  return Number(totalCost.toFixed(6));
} 