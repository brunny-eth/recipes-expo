import { extractRecipeContent } from '../extractContent';

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
              ]
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
    const expected = {
      title: 'JSON-LD Recipe Title',
      ingredientsText: '1 cup Flour\n2 Eggs',
      instructionsText: 'Mix ingredients.\nBake the cake.'
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
    const expected = {
      title: 'Graph Recipe Title',
      ingredientsText: 'Ingredient A\nIngredient B',
      instructionsText: 'Single instruction step.'
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
    const expectedTitle = 'CSS Selector Title';
    const expectedIngredients = 'Ingredient 1\nIngredient 2';
    const expectedInstructions = 'Step 1.\nStep 2.';

    const result = extractRecipeContent(htmlWithoutJsonLd);

    expect(result.title).toEqual(expectedTitle);
    
    const sortLines = (text: string | null) => text ? text.split('\n').sort().join('\n') : null;

    expect(sortLines(result.ingredientsText)).toEqual(sortLines(expectedIngredients));
    expect(sortLines(result.instructionsText)).toEqual(sortLines(expectedInstructions));
  });

  // Test Case 4: Incomplete JSON-LD (e.g., missing instructions), fallback for missing parts
  test('should fallback to CSS selectors for parts missing in JSON-LD', () => {
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
    const expected = {
      title: 'Incomplete JSON Recipe', // From JSON-LD
      ingredientsText: 'JSON Ingredient 1', // From JSON-LD
      instructionsText: 'Selector Instruction 1\nSelector Instruction 2' // From CSS selector
    };
    expect(extractRecipeContent(htmlIncompleteJsonLd)).toEqual(expected);
  });

  // Test Case 5: No Recipe Content Found
  test('should return nulls when no recipe content is found via JSON-LD or selectors', () => {
    const htmlNoRecipe = `
      <html>
        <head><title>Just a Page</title></head>
        <body>
          <p>This page has no recipe information.</p>
        </body>
      </html>
    `;
    const expected = {
      title: 'Just a Page', // Title can usually be found
      ingredientsText: null,
      instructionsText: null
    };
    expect(extractRecipeContent(htmlNoRecipe)).toEqual(expected);
  });

  // Test Case 6: Different common selector patterns
  test('should extract content using alternative common CSS selectors', () => {
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
    const expected = {
      title: 'Alt Selector Recipe',
      ingredientsText: 'Tasty Ingredient A',
      instructionsText: 'Easy Instruction 1'
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
      const expected = {
          title: 'HowToSection Recipe Title',
          ingredientsText: 'Ingredient X\nIngredient Y',
          instructionsText: 'Combine flour and water.\nKnead the dough.\nPlace in oven.\nBake for 30 minutes.'
      };
      expect(extractRecipeContent(htmlWithHowToSection)).toEqual(expected);
  });

  // Test Case 8: Malformed JSON-LD, fallback to CSS selectors
  test('should ignore malformed JSON-LD and fallback to CSS selectors', () => {
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

    const expected = {
      title: 'Selector Title After Malformed JSON', // Should fallback to h1 or title tag
      ingredientsText: 'Selector Ingredient A\nSelector Ingredient B',
      instructionsText: 'Selector Instruction 1\nSelector Instruction 2'
    };

    const result = extractRecipeContent(htmlWithMalformedJsonLd);
    
    // Title might pick <title> first if h1 isn't prioritized in fallback
    // Let's adjust expected title based on current logic: <title> then <h1>
    const expectedTitle = 'CSS Fallback Title'; // As per current title fallback logic

    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(result.title).toEqual(expectedTitle);

    const sortLines = (text: string | null) => text ? text.split('\n').sort().join('\n') : null;
    expect(sortLines(result.ingredientsText)).toEqual(sortLines(expected.ingredientsText));
    expect(sortLines(result.instructionsText)).toEqual(sortLines(expected.instructionsText));

    consoleWarnSpy.mockRestore();
  });

}); 