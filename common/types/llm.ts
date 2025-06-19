import { GoogleGenerativeAI } from "@google/generative-ai";
import { StandardizedUsage } from "../../server/utils/usageUtils";
import { CombinedParsedRecipe } from "./recipes";

// Gemini Model Type
export type GeminiModel = ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']>;

// --- Shared Gemini Handler Response Type ---
export type GeminiHandlerResponse = {
    recipe: CombinedParsedRecipe | null;
    error: string | null;
    usage: StandardizedUsage;
    timings: { geminiCombinedParse: number; };
}; 