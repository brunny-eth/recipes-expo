import { extractRecipeContent, ExtractedContent } from '../extractContent';

describe('extractRecipeContent', () => {

  // Test Case 1: Valid JSON-LD
  test('should extract content correctly from valid JSON-LD', () => {
    const htmlWithJsonLd = `
      <html>
        <head>
          <title>Fallback Title</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "Recipe",
              "name": "JSON-LD Recipe Title",
              "recipeIngredient": [
                "1 cup Flour",
                "2 Eggs"
              ],
              "recipeInstructions": [
                {
                  "@type": "HowToStep",
                  "text": "Mix ingredients."
                },
                {
                  "@type": "HowToStep",
                  "text": "Bake the cake."
                }
              ],
              "recipeYield": "4 servings",
              "prepTime": "PT15M",
              "cookTime": "PT30M",
              "totalTime": "PT45M"
            }
          </script>
        </head>
        <body>
          <h1>HTML Title</h1>
          <div class="ingredients">
            <ul><li>HTML Ingredient</li></ul>
          </div>
           <div class="instructions">
            <ol><li>HTML Instruction</li></ol>
          </div>
        </body>
      </html>
    `;
    const expected: ExtractedContent = {
      title: 'JSON-LD Recipe Title',
      ingredientsText: '1 cup Flour\n2 Eggs',
      instructionsText: 'Mix ingredients.\nBake the cake.',
      recipeYieldText: '4 servings',
      prepTime: 'PT15M',
      cookTime: 'PT30M',
      totalTime: 'PT45M',
      isFallback: false
    };
    expect(extractRecipeContent(htmlWithJsonLd)).toEqual(expected);
  });

  // Test Case 2: JSON-LD in @graph
  test('should extract content correctly from JSON-LD within @graph', () => {
    const htmlWithGraphJsonLd = `
      <html>
        <head><title>Graph Test</title></head>
        <body>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@graph": [
                {
                  "@type": "WebSite",
                  "name": "Website Name"
                },
                {
                  "@type": "Recipe",
                  "name": "Graph Recipe Title",
                  "recipeIngredient": ["Ingredient A", "Ingredient B"],
                  "recipeInstructions": "Single instruction step."
                }
              ]
            }
          </script>
        </body>
      </html>
    `;
    const expected: ExtractedContent = {
      title: 'Graph Recipe Title',
      ingredientsText: 'Ingredient A\nIngredient B',
      instructionsText: 'Single instruction step.',
      recipeYieldText: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      isFallback: false
    };
    expect(extractRecipeContent(htmlWithGraphJsonLd)).toEqual(expected);
  });

  // Test Case 3: Fallback to CSS Selectors (No JSON-LD)
  test('should extract content using CSS selectors when JSON-LD is missing', () => {
    const htmlWithoutJsonLd = `
      <html>
        <head><title>CSS Selector Title</title></head>
        <body>
          <h1>Another H1 Title</h1>
          <ul class="ingredients">
            <li>Ingredient 1</li>
            <li itemprop="recipeIngredient">Ingredient 2</li>
          </ul>
          <div class="wprm-recipe-instructions">
            <p>Step 1.</p>
            <li>Step 2.</li>
          </div>
        </body>
      </html>
    `;
    const expectedFallbackText = "Another H1 Title\n Ingredient 1\n Ingredient 2\n Step 1.\n Step 2.";
    const result = extractRecipeContent(htmlWithoutJsonLd);

    expect(result.title).toEqual('CSS Selector Title');
    expect(result.ingredientsText).toEqual(expectedFallbackText);
    expect(result.instructionsText).toEqual(expectedFallbackText);
    expect(result.recipeYieldText).toBeNull();
    expect(result.prepTime).toBeNull();
    expect(result.cookTime).toBeNull();
    expect(result.totalTime).toBeNull();
    expect(result.isFallback).toBe(true);
  });

  // Test Case 4: Incomplete JSON-LD (e.g., missing instructions), fallback for missing parts
  test('should fallback to CSS selectors for parts missing in JSON-LD and handle short content fallback', () => {
    const htmlIncompleteJsonLd = `
      <html>
        <head>
          <title>Fallback Title</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "Recipe",
              "name": "Incomplete JSON Recipe",
              "recipeIngredient": ["JSON Ingredient 1"]
            }
          </script>
        </head>
        <body>
          <ol class="instructions">
             <li>Selector Instruction 1</li>
             <li>Selector Instruction 2</li>
          </ol>
        </body>
      </html>
    `;
    const expectedFallbackText = "Selector Instruction 1\n Selector Instruction 2";
    const expected: ExtractedContent = {
      title: 'Incomplete JSON Recipe',
      ingredientsText: expectedFallbackText,
      instructionsText: expectedFallbackText,
      recipeYieldText: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      isFallback: true
    };
    expect(extractRecipeContent(htmlIncompleteJsonLd)).toEqual(expected);
  });

  // Test Case 5: No Recipe Content Found
  test('should return fallback body text when no recipe content is found via JSON-LD or selectors', () => {
    const htmlNoRecipe = `
      <html>
        <head><title>Just a Page</title></head>
        <body>
          <p>This page has no recipe information.</p>
        </body>
      </html>
    `;
    const expectedFallbackText = "This page has no recipe information.";
    const expected: ExtractedContent = {
      title: 'Just a Page', // Title from <title>
      ingredientsText: expectedFallbackText,
      instructionsText: expectedFallbackText,
      recipeYieldText: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      isFallback: true
    };
    expect(extractRecipeContent(htmlNoRecipe)).toEqual(expected);
  });

  // Test Case 6: Different common selector patterns
  test('should extract content using alternative common CSS selectors and handle short content fallback', () => {
    const htmlAlternativeSelectors = `
      <html>
        <head><title>Alt Selector Recipe</title></head>
        <body>
          <div class="tasty-recipes-ingredients">
             <ul><li>Tasty Ingredient A</li></ul>
          </div>
          <ol class="easyrecipe-instructions">
            <li>Easy Instruction 1</li>
          </ol>
        </body>
      </html>
    `;
    const expectedFallbackText = "Tasty Ingredient A\n Easy Instruction 1";
    const expected: ExtractedContent = {
      title: 'Alt Selector Recipe',
      ingredientsText: expectedFallbackText,
      instructionsText: expectedFallbackText,
      recipeYieldText: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      isFallback: true
    };
    expect(extractRecipeContent(htmlAlternativeSelectors)).toEqual(expected);
  });

  // Test Case 7: Instructions as HowToSection in JSON-LD
  test('should extract instructions from HowToSection in JSON-LD', () => {
      const htmlWithHowToSection = `
      <html>
        <head>
          <title>HowToSection Test</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "Recipe",
              "name": "HowToSection Recipe Title",
              "recipeIngredient": ["Ingredient X", "Ingredient Y"],
              "recipeInstructions": [
                {
                  "@type": "HowToSection",
                  "name": "Make the dough",
                  "itemListElement": [
                    {"@type": "HowToStep", "text": "Combine flour and water."},
                    {"@type": "HowToStep", "text": "Knead the dough."}
                  ]
                },
                 {
                  "@type": "HowToSection",
                  "name": "Bake",
                  "itemListElement": [
                    {"@type": "HowToStep", "text": "Place in oven."},
                    {"@type": "HowToStep", "text": "Bake for 30 minutes."}
                  ]
                }
              ]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
      const expected: ExtractedContent = {
          title: 'HowToSection Recipe Title',
          ingredientsText: 'Ingredient X\nIngredient Y',
          instructionsText: 'Combine flour and water.\nKnead the dough.\nPlace in oven.\nBake for 30 minutes.',
          recipeYieldText: null,
          prepTime: null,
          cookTime: null,
          totalTime: null,
          isFallback: false
      };
      expect(extractRecipeContent(htmlWithHowToSection)).toEqual(expected);
  });

  // Test Case 8: Malformed JSON-LD, fallback to CSS selectors, then to body
  test('should ignore malformed JSON-LD and fallback to CSS selectors, then to body if short', () => {
    const htmlWithMalformedJsonLd = `
      <html>
        <head>
          <title>CSS Fallback Title</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org/",
              "@type": "Recipe",
              "name": "Malformed JSON Recipe Title",
              "recipeIngredient": ["JSON Ing 1", "JSON Ing 2"], // Trailing comma here is an error
            }
          </script>
        </head>
        <body>
          <h1 class="recipe-title">Selector Title After Malformed JSON</h1>
          <ul class="ingredients">
            <li>Selector Ingredient A</li>
            <li>Selector Ingredient B</li>
          </ul>
          <div class="instructions">
            <p>Selector Instruction 1</p>
            <p>Selector Instruction 2</p>
          </div>
        </body>
      </html>
    `;

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = extractRecipeContent(htmlWithMalformedJsonLd);
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Ignoring JSON-LD parsing error:", 
      expect.any(SyntaxError)
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[extractContent] Fallback: using raw body text due to missing or short (50 chars) ingredients and/or instructions.')
    );

    const expectedFallbackText = "Selector Title After Malformed JSON\n Selector Ingredient A\n Selector Ingredient B\n Selector Instruction 1\n Selector Instruction 2";
    
    expect(result.title).toEqual('CSS Fallback Title');
    expect(result.ingredientsText).toEqual(expectedFallbackText);
    expect(result.instructionsText).toEqual(expectedFallbackText);
    expect(result.recipeYieldText).toBeNull();
    expect(result.prepTime).toBeNull();
    expect(result.cookTime).toBeNull();
    expect(result.totalTime).toBeNull();
    expect(result.isFallback).toBe(true);

    consoleWarnSpy.mockRestore();
  });

}); 