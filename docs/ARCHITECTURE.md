# Architecture Overview

This monorepo contains both the **Expo React Native** frontend and a **serverless Express** backend deployed on Vercel. Below is a summary of the key components and structure:

```
/ (project root)
├─ app/             # Expo React Native application
│  ├─ (tabs)/       # Tab-based navigation screens
│  └─ recipe/       # Ingredient screen, substitution modal, steps screen
│
├─ api/             # Serverless API routes (Express app)
│  ├─ index.ts      # Express app entrypoint (mounted by Vercel)
│  ├─ lib/          # Helper modules (e.g., Supabase client)
│  │   └─ supabase.ts
│  ├─ routes/       # Modular Express routers (recipes, ingredients)
│  └─ types/        # Shared TypeScript types (Supabase schema)
│
├─ docs/            # Project documentation (this folder)
│  ├─ ARCHITECTURE.md
│  └─ CURSOR_CONTEXT.md
│
├─ package.json     # Defines scripts & dependencies for both frontend & backend
├─ vercel.json      # Routes `/api/*` to the Express serverless function
├─ tsconfig.json    # Root TS config (extends Expo base)
└─ api/tsconfig.json # TS config for backend (commonjs mode)
```

## Frontend (Expo React Native)
- **Navigation**: Bottom tabs for Home, Saved, Settings
- **Home Screen**: Paste recipe link, submit button, loading spinner
- **Ingredients Screen**: List with checkboxes, amounts in parentheses, substitution UI
- **Substitution Modal**: Animated selection of replacement ingredients
- **Serving Logic**: Smart fraction-handling and scaling with `adjustIngredientAmount`
- **Styling**: Centralized `COLORS` theme, Poppins fonts, SafeAreaView

## Backend (Serverless Express on Vercel)
- **Express App**: Defined in `api/index.ts`, exported as Default
- **Health Check**: `GET /api/health` returns a simple status
- **Routers**: Mounted at `/api/recipes` and `/api/ingredients`

### Recipe Parsing (`POST /api/recipes/parse`)
The core recipe processing logic resides in the `POST /api/recipes/parse` endpoint. This endpoint is responsible for taking user input and transforming it into a structured recipe format.

-   **Input Handling**:
    -   Accepts a single `input` field in the JSON request body.
    -   This `input` can be either a recipe URL or free-form recipe text (e.g., copied from a social media post or a notes app).
-   **Input Type Detection**:
    -   A heuristic function (`detectInputType` in `api/routes/recipes.ts`) is used to determine if the input is likely a URL. This check primarily looks for the presence of a period (`.`) and the absence of whitespace characters in the trimmed input string.
-   **URL Processing Path**:
    -   If the input is classified as a URL:
        -   **Caching (Read)**: The system first queries a Supabase table (`processed_recipes_cache`) to check if the URL has been processed and cached previously. If a valid cache entry exists, the cached recipe data is returned immediately.
        -   **Fetching HTML**: If not cached, the HTML content of the URL is fetched. This involves a direct `fetch` attempt first. If the direct fetch fails (e.g., due to anti-scraping measures like a 403 error), a fallback mechanism uses the ScraperAPI service to retrieve the HTML.
        -   **Content Extraction**: Key sections of the recipe (title, ingredients list, instructions) are extracted from the fetched HTML. This is done using the `cheerio` library, prioritizing structured data from JSON-LD scripts (`<script type="application/ld+json">`) if available, and falling back to common HTML element selectors for recipes.
        -   **AI Parsing (Gemini)**: The extracted textual content (title, ingredients text, instructions text) is then passed to a Generative AI model (Google Gemini via `gemini-2.0-flash-exp`). A specific prompt guides the AI to parse these text sections into a structured JSON object (`CombinedParsedRecipe` type defined in `api/routes/recipes.ts`). This includes structuring ingredients with amounts and units, generating ingredient substitution suggestions, and formatting instructions.
        -   **Caching (Write)**: The successfully parsed recipe data from the AI is then stored in the `processed_recipes_cache` table in Supabase, using the original URL as the key, for future requests.
-   **Raw Text Processing Path**:
    -   If the input is classified as raw text (i.e., not a URL):
        -   **AI Parsing (Gemini)**: The entire raw text is passed directly to the Google Gemini AI model (`gemini-2.0-flash-exp`).
        -   A different, specialized prompt instructs the AI to identify and extract the recipe title, ingredients (including parsing names, amounts, units, and suggesting substitutions), cooking instructions, and any other available metadata (like servings/yield, preparation time, cooking time, total time, and basic nutritional information such as calories and protein) directly from the unstructured text.
        -   The AI is tasked with returning this information in the same `CombinedParsedRecipe` JSON format as the URL path.
        -   **Caching**: Currently, results from raw text parsing are *not* cached in the Supabase table.
-   **Output Format (Unified)**:
    -   Regardless of the processing path (URL or raw text), the endpoint aims to return a consistent JSON response. This response includes metadata about the request (like `inputType: 'url' | 'raw_text'`) and, crucially, a `recipe` object containing the structured recipe data (fields include `title`, `ingredients` array, `instructions` array, `recipeYield`, `prepTime`, `cookTime`, `totalTime`, `nutrition`, `substitutions_text`).

- **Database**: Supabase (PostgreSQL)
  - Tables: `recipes`, `ingredients`, `substitutions`, `processed_recipes_cache` (for caching parsed URL data)
  - Relationships via foreign keys
- **Deployment**: Vercel serverless functions (auto-scaling, zero maintenance) 
```

</rewritten_file>