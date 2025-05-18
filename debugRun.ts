import { parseAndCacheRecipe } from "../api/services/parseRecipe";
import scraperapiClient from "scraperapi-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import logger from "../api/lib/logger";
dotenv.config();

const scraperApiKey = process.env.SCRAPERAPI_KEY || "";
const geminiApiKey = process.env.GOOGLE_API_KEY || "";

if (!scraperApiKey || !geminiApiKey) {
  throw new Error("Missing SCRAPERAPI_KEY or GOOGLE_API_KEY in .env");
}

const scraperClient = scraperapiClient(scraperApiKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);
const geminiModel = genAI.getGenerativeModel({ model: "models/gemini-pro" });

const testInputs: string[] = [
  "https://www.foodnetwork.com/recipes/food-network-kitchen/nigerian-meat-pies-12514128",
  "https://www.allrecipes.com/swedish-princess-cake-prinsesstarta-recipe-11730456",
  "https://www.halfbakedharvest.com/dijon-salmon/",

  // Raw text example
  `Recipe Title: Simple Omelet
Ingredients:
- 2 eggs
- 2 tablespoons milk
- Salt and pepper to taste
- 1 tablespoon butter
- 1/4 cup shredded cheese

Instructions:
1. In a bowl, beat the eggs with the milk, salt, and pepper.
2. Melt butter in a skillet over medium heat.
3. Pour in the egg mixture and cook until nearly set.
4. Sprinkle cheese on one half, fold the omelet, and cook until cheese is melted.`,
];

(async () => {
  for (const input of testInputs) {
    console.log("\n===============================");
    console.log(`🔍 Running test for: ${input.slice(0, 100)}...`);
    console.log("===============================\n");

    const result = await parseAndCacheRecipe(
      input,
      geminiModel as any,
      scraperApiKey,
      scraperClient
    );

    const { recipe, error, fromCache, inputType, cacheKey, timings, usage, fetchMethodUsed } = result;

    logger.info(
      { inputType, cacheKey, fetchMethodUsed, fromCache, timings, usage },
      "🔍 Pipeline summary"
    );

    if (error) {
      logger.error({ input, error }, "❌ Pipeline failed for input");
    } else {
      logger.info(
        {
          title: recipe?.title,
          numIngredients: recipe?.ingredients?.length,
          servings: recipe?.recipeYield,
        },
        "✅ Final recipe summary"
      );
    }

    console.log("\nParsed Recipe:");
    console.dir(recipe, { depth: null });
    console.log("\n===============================\n");
  }
})();