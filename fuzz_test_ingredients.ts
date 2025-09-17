#!/usr/bin/env ts-node

/**
 * Fuzz Testing Script for normalizeName Function
 * 
 * This script tests the normalizeName function with real-world ingredient data
 * to find edge cases and unexpected behaviors.
 */

import { normalizeName, parseAndNormalizeIngredient } from './utils/groceryHelpers';

// Real ingredients from your database
const realIngredients = [
  // From Caprese Chicken Parmesan
  "all-purpose flour",
  "Panko breadcrumbs", 
  "grated parmesan cheese",
  "salt",
  "black pepper",
  "eggs",
  "chicken cutlets",
  "extra-virgin olive oil",
  "tomatoes",
  "shredded mozzarella cheese",
  "fresh basil leaves",
  "jarred pasta sauce",
  "Italian dressing",
  "shallot",
  "garlic powder",
  "dijon mustard",
  "lemon zest",
  "lemon juice",
  "honey",
  "dried dill",
  "chili flakes",
  
  // From Vegan Chicken
  "firm tofu",
  "nutritional yeast",
  "garlic powder",
  "onion powder", 
  "chicken seasoning",
  "salt",
  "vegan chicken stock",
  "vital wheat gluten",
  "extra virgin olive oil",
  "lemon wedges",
  
  // From Japanese Carrot Ginger Dressing
  "carrots",
  "onion",
  "ginger",
  "granulated sugar",
  "soy sauce",
  "rice vinegar",
  "salt",
  "organic canola oil"
];

// Additional realistic ingredient variations and edge cases
const fuzzIngredients = [
  // Messy real-world variations
  "1 14.5 oz can diced fire-roasted tomatoes (drained)",
  "2-3 large yellow onions, chopped",
  "~1/2 cup extra virgin olive oil",
  "about 1/4 cup fresh basil, roughly chopped",
  "1-2 cloves garlic, minced",
  "1/2 tsp. sea salt (or to taste)",
  "freshly ground black pepper, to taste",
  "1 lb. ground beef (80/20)",
  "1/2 cup grated parmesan cheese (freshly grated)",
  "2 cups shredded mozzarella cheese",
  "1/4 cup panko breadcrumbs",
  "1 tbsp. Italian seasoning",
  "1/2 tsp. red pepper flakes",
  "1/4 cup fresh parsley, chopped",
  "1/2 cup heavy cream",
  "1/4 cup white wine",
  "2 tbsp. butter",
  "1 tbsp. all-purpose flour",
  "1/2 cup chicken broth",
  "1/4 cup half & half",
  
  // Common misspellings and variations
  "tomatos",
  "potatos", 
  "onions (chopped)",
  "garlic cloves",
  "green onions",
  "spring onions",
  "scallions",
  "evoo",
  "cooking oil",
  "vegetable cooking oil",
  "iodized salt",
  "table salt",
  "kosher salt",
  "sea salt",
  "pink salt",
  "himalayan salt",
  "flaky salt",
  
  // Size descriptors
  "large carrots",
  "medium potatoes",
  "small apples",
  "jumbo shrimp",
  "mini cucumbers",
  "baby potatoes",
  "fingerling potatoes",
  "extra large eggs",
  "small potatoes",
  
  // Preparation descriptors
  "chopped parsley",
  "diced onion",
  "minced garlic",
  "fresh herbs",
  "dried herbs",
  "ripe bananas",
  "fresh tomatoes",
  "canned tomatoes",
  "diced tomatoes",
  "crushed tomatoes",
  "whole tomatoes",
  "sun dried tomatoes",
  "roasted red peppers",
  "shredded cheese",
  "grated cheese",
  "sliced cheese",
  "cubed cheese",
  
  // Color/variety descriptors
  "red onion",
  "yellow onion", 
  "white onion",
  "sweet onion",
  "vidalia onion",
  "red potatoes",
  "golden potatoes",
  "russet potatoes",
  "yukon gold potatoes",
  "purple potatoes",
  "white potatoes",
  "sweet potatoes",
  "roma tomatoes",
  "cherry tomatoes",
  "grape tomatoes",
  "beefsteak tomatoes",
  
  // Oil varieties
  "olive oil",
  "extra virgin olive oil",
  "sesame oil",
  "canola oil",
  "vegetable oil",
  "coconut oil",
  "avocado oil",
  "peanut oil",
  "walnut oil",
  "flaxseed oil",
  
  // Spices and seasonings
  "black pepper",
  "white pepper",
  "cayenne pepper",
  "paprika",
  "smoked paprika",
  "chili powder",
  "cumin",
  "coriander",
  "turmeric",
  "cinnamon",
  "nutmeg",
  "allspice",
  "cloves",
  "bay leaves",
  "thyme",
  "rosemary",
  "oregano",
  "basil",
  "cilantro",
  "parsley",
  "dill",
  "chives",
  "mint",
  "sage",
  "tarragon",
  "marjoram",
  
  // Dairy products
  "milk",
  "whole milk",
  "2% milk",
  "skim milk",
  "buttermilk",
  "heavy cream",
  "light cream",
  "half & half",
  "sour cream",
  "greek yogurt",
  "plain yogurt",
  "cottage cheese",
  "cream cheese",
  "ricotta cheese",
  "feta cheese",
  "goat cheese",
  "blue cheese",
  "cheddar cheese",
  "aged cheddar",
  "swiss cheese",
  "provolone cheese",
  "mozzarella cheese",
  "fresh mozzarella",
  "shredded mozzarella",
  "parmesan cheese",
  "grated parmesan",
  "pecorino romano",
  
  // Grains and flours
  "all-purpose flour",
  "whole wheat flour",
  "bread flour",
  "cake flour",
  "pastry flour",
  "unbleached flour",
  "self-rising flour",
  "rice flour",
  "almond flour",
  "coconut flour",
  "oat flour",
  "chickpea flour",
  "buckwheat flour",
  "spelt flour",
  "rye flour",
  "cornmeal",
  "polenta",
  "breadcrumbs",
  "panko breadcrumbs",
  "regular breadcrumbs",
  "oats",
  "rolled oats",
  "steel cut oats",
  "quinoa",
  "brown rice",
  "white rice",
  "wild rice",
  "barley",
  "bulgur",
  "couscous",
  "pasta",
  "spaghetti",
  "penne",
  "rigatoni",
  "fettuccine",
  "linguine",
  "angel hair",
  "lasagna noodles",
  "egg noodles",
  "rice noodles",
  "soba noodles",
  "ramen noodles",
  
  // Legumes and beans
  "black beans",
  "kidney beans",
  "pinto beans",
  "navy beans",
  "garbanzo beans",
  "chickpeas",
  "lentils",
  "red lentils",
  "green lentils",
  "brown lentils",
  "split peas",
  "green peas",
  "edamame",
  "tofu",
  "firm tofu",
  "soft tofu",
  "silken tofu",
  "tempeh",
  "miso paste",
  "soy sauce",
  "tamari",
  "worcestershire sauce",
  "fish sauce",
  "oyster sauce",
  "hoisin sauce",
  "teriyaki sauce",
  "sriracha",
  "hot sauce",
  "tabasco",
  "chili sauce",
  "ketchup",
  "mustard",
  "dijon mustard",
  "yellow mustard",
  "whole grain mustard",
  "honey mustard",
  "mayonnaise",
  "miracle whip",
  "ranch dressing",
  "italian dressing",
  "caesar dressing",
  "balsamic vinegar",
  "red wine vinegar",
  "white wine vinegar",
  "apple cider vinegar",
  "rice vinegar",
  "sherry vinegar",
  "champagne vinegar",
  "distilled white vinegar",
  
  // Sweeteners
  "sugar",
  "granulated sugar",
  "brown sugar",
  "light brown sugar",
  "dark brown sugar",
  "powdered sugar",
  "confectioners sugar",
  "honey",
  "maple syrup",
  "agave nectar",
  "molasses",
  "corn syrup",
  "golden syrup",
  "stevia",
  "splenda",
  "turbinado sugar",
  "demerara sugar",
  "coconut sugar",
  "palm sugar",
  "jaggery",
  
  // Nuts and seeds
  "almonds",
  "walnuts",
  "pecans",
  "cashews",
  "pistachios",
  "hazelnuts",
  "macadamia nuts",
  "pine nuts",
  "peanuts",
  "peanut butter",
  "almond butter",
  "cashew butter",
  "sunflower seeds",
  "pumpkin seeds",
  "sesame seeds",
  "chia seeds",
  "flax seeds",
  "hemp seeds",
  "poppy seeds",
  "caraway seeds",
  "fennel seeds",
  "cumin seeds",
  "coriander seeds",
  "mustard seeds",
  "celery seeds",
  
  // Fruits
  "apples",
  "bananas",
  "oranges",
  "lemons",
  "limes",
  "grapefruit",
  "strawberries",
  "blueberries",
  "raspberries",
  "blackberries",
  "cranberries",
  "cherries",
  "grapes",
  "peaches",
  "pears",
  "plums",
  "apricots",
  "mangoes",
  "pineapple",
  "coconut",
  "avocados",
  "figs",
  "dates",
  "raisins",
  "dried cranberries",
  "dried apricots",
  "dried figs",
  "dried dates",
  "prunes",
  
  // Vegetables
  "carrots",
  "celery",
  "onions",
  "garlic",
  "ginger",
  "potatoes",
  "sweet potatoes",
  "yams",
  "beets",
  "radishes",
  "turnips",
  "rutabagas",
  "parsnips",
  "broccoli",
  "cauliflower",
  "brussels sprouts",
  "cabbage",
  "red cabbage",
  "napa cabbage",
  "bok choy",
  "kale",
  "spinach",
  "lettuce",
  "romaine lettuce",
  "iceberg lettuce",
  "arugula",
  "watercress",
  "endive",
  "radicchio",
  "fennel",
  "artichokes",
  "asparagus",
  "green beans",
  "snap peas",
  "snow peas",
  "corn",
  "peas",
  "lima beans",
  "okra",
  "eggplant",
  "zucchini",
  "yellow squash",
  "summer squash",
  "winter squash",
  "butternut squash",
  "acorn squash",
  "spaghetti squash",
  "pumpkin",
  "cucumbers",
  "tomatoes",
  "bell peppers",
  "red bell peppers",
  "yellow bell peppers",
  "green bell peppers",
  "orange bell peppers",
  "jalapeños",
  "serrano peppers",
  "habanero peppers",
  "poblano peppers",
  "anaheim peppers",
  "mushrooms",
  "button mushrooms",
  "cremini mushrooms",
  "portobello mushrooms",
  "shiitake mushrooms",
  "oyster mushrooms",
  "enoki mushrooms",
  "maitake mushrooms",
  "chanterelle mushrooms",
  "morel mushrooms",
  "truffles",
  
  // Proteins
  "chicken breast",
  "chicken thighs",
  "chicken wings",
  "chicken drumsticks",
  "whole chicken",
  "ground chicken",
  "chicken sausage",
  "turkey breast",
  "ground turkey",
  "turkey sausage",
  "beef",
  "ground beef",
  "beef chuck",
  "beef brisket",
  "beef short ribs",
  "beef tenderloin",
  "beef sirloin",
  "beef ribeye",
  "beef strip steak",
  "beef flank steak",
  "beef skirt steak",
  "beef round steak",
  "beef shank",
  "beef oxtail",
  "lamb",
  "ground lamb",
  "lamb chops",
  "lamb leg",
  "lamb shoulder",
  "pork",
  "ground pork",
  "pork chops",
  "pork tenderloin",
  "pork shoulder",
  "pork belly",
  "bacon",
  "pancetta",
  "prosciutto",
  "ham",
  "spam",
  "sausage",
  "italian sausage",
  "chorizo",
  "andouille sausage",
  "kielbasa",
  "bratwurst",
  "hot dogs",
  "fish",
  "salmon",
  "tuna",
  "cod",
  "halibut",
  "mahi mahi",
  "swordfish",
  "mackerel",
  "sardines",
  "anchovies",
  "shrimp",
  "crab",
  "lobster",
  "scallops",
  "mussels",
  "clams",
  "oysters",
  "squid",
  "octopus",
  "caviar",
  "roe",
  "eggs",
  "egg whites",
  "egg yolks",
  "quail eggs",
  "duck eggs",
  
  // Canned and preserved foods
  "canned tomatoes",
  "tomato paste",
  "tomato sauce",
  "tomato puree",
  "crushed tomatoes",
  "diced tomatoes",
  "whole tomatoes",
  "fire roasted tomatoes",
  "sun dried tomatoes",
  "canned beans",
  "canned corn",
  "canned peas",
  "canned mushrooms",
  "canned artichokes",
  "canned olives",
  "canned tuna",
  "canned salmon",
  "canned sardines",
  "canned anchovies",
  "canned clams",
  "canned mussels",
  "canned coconut milk",
  "coconut cream",
  "canned pumpkin",
  "canned sweet potatoes",
  "canned pineapple",
  "canned peaches",
  "canned pears",
  "canned cherries",
  "canned cranberries",
  "canned mandarin oranges",
  "canned green beans",
  "canned asparagus",
  "canned beets",
  "canned carrots",
  "canned potatoes",
  "canned mixed vegetables",
  "canned soup",
  "chicken broth",
  "beef broth",
  "vegetable broth",
  "fish stock",
  "clam juice",
  "coconut water",
  "apple juice",
  "orange juice",
  "cranberry juice",
  "grape juice",
  "pineapple juice",
  "tomato juice",
  "vegetable juice",
  "pickles",
  "pickled onions",
  "pickled beets",
  "pickled jalapeños",
  "pickled ginger",
  "sauerkraut",
  "kimchi",
  "olives",
  "black olives",
  "green olives",
  "kalamata olives",
  "capers",
  "sun dried tomatoes",
  "roasted red peppers",
  "marinated artichokes",
  "roasted peppers",
  "pepperoncini",
  "banana peppers",
  "sweet peppers",
  "hot peppers",
  "chili peppers",
  "bell peppers",
  "poblano peppers",
  "jalapeño peppers",
  "serrano peppers",
  "habanero peppers",
  "scotch bonnet peppers",
  "ghost peppers",
  "carolina reaper peppers",
  "trinidad scorpion peppers",
  "naga viper peppers",
  "dragon's breath peppers",
  "pepper x peppers",
  "apocalypse scorpion peppers",
  "chocolate bhutlah peppers",
  "7 pot primo peppers",
  "moruga scorpion peppers",
  "butch t peppers",
  "brain strain peppers",
  "douglah peppers",
  "infinity peppers",
  "naga morich peppers",
  "red savina peppers",
  "dorset naga peppers",
  "bhut jolokia peppers",
  "trinidad moruga scorpion peppers",
  "pepper x peppers",
  "apocalypse scorpion peppers",
  "chocolate bhutlah peppers",
  "7 pot primo peppers",
  "moruga scorpion peppers",
  "butch t peppers",
  "brain strain peppers",
  "douglah peppers",
  "infinity peppers",
  "naga morich peppers",
  "red savina peppers",
  "dorset naga peppers",
  "bhut jolokia peppers",
  "trinidad moruga scorpion peppers"
];

// Combine all ingredients
const allIngredients = [...realIngredients, ...fuzzIngredients];

// Function to run fuzz tests
function runFuzzTests() {
  console.log('🧪 Starting Fuzz Tests for ingredient processing...\n');
  console.log(`Testing ${allIngredients.length} ingredients\n`);
  
  const results: FuzzResult[] = [];
  const errors: FuzzError[] = [];
  const suspicious: SuspiciousResult[] = [];
  
  for (let i = 0; i < allIngredients.length; i++) {
    const ingredient = allIngredients[i];
    
    try {
      // Test the new combined function for full ingredient strings
      const parsed = parseAndNormalizeIngredient(ingredient);
      const result = {
        input: ingredient,
        output: parsed.name, // Just the normalized name
        index: i + 1,
        parsed: parsed // Include full parsed structure for analysis
      };
      
      results.push(result);
      
      // Check for suspicious results
      if (parsed.name === '' || parsed.name === ' ') {
        suspicious.push({...result, reason: 'Empty or whitespace output'});
      } else if (parsed.name.length > ingredient.length * 2) {
        suspicious.push({...result, reason: 'Output significantly longer than input'});
      } else if (parsed.name.includes('undefined') || parsed.name.includes('null')) {
        suspicious.push({...result, reason: 'Contains undefined/null'});
      } else if (parsed.name !== parsed.name.toLowerCase()) {
        suspicious.push({...result, reason: 'Contains uppercase letters'});
      }
      
      // Check for measurement/unit contamination in the name
      if (parsed.name.match(/\d+/) && ingredient.match(/\d+/)) {
        // Check if numbers from measurements leaked into the name
        const inputNumbers: string[] = ingredient.match(/\d+/g) || [];
        const nameNumbers: string[] = parsed.name.match(/\d+/g) || [];
        if (nameNumbers.some((num: string) => inputNumbers.includes(num))) {
          suspicious.push({...result, reason: 'Measurement numbers leaked into name'});
        }
      }
      
      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`Processed ${i + 1}/${allIngredients.length} ingredients...`);
      }
      
    } catch (error) {
      errors.push({
        input: ingredient,
        error: error instanceof Error ? error.message : String(error),
        index: i + 1
      });
    }
  }
  
  // Generate report
  console.log('\n📊 Fuzz Test Results:');
  console.log('='.repeat(50));
  console.log(`Total ingredients tested: ${allIngredients.length}`);
  console.log(`Successful normalizations: ${results.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Suspicious results: ${suspicious.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(err => {
      console.log(`  ${err.index}. "${err.input}" → ERROR: ${err.error}`);
    });
  }
  
  if (suspicious.length > 0) {
    console.log('\n⚠️  Suspicious Results:');
    suspicious.forEach(sus => {
      console.log(`  ${sus.index}. "${sus.input}" → "${sus.output}" (${sus.reason})`);
    });
  }
  
  // Save detailed results to file
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `fuzz_test_results_${timestamp}.json`;
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: allIngredients.length,
      successful: results.length,
      errors: errors.length,
      suspicious: suspicious.length
    },
    results: results,
    errors: errors,
    suspicious: suspicious
  };
  
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n💾 Detailed results saved to: ${filename}`);
  
  // Show some interesting examples
  console.log('\n🔍 Sample Results:');
  console.log('-'.repeat(50));
  
  // Show first 20 results
  results.slice(0, 20).forEach(result => {
    console.log(`"${result.input}" → "${result.output}"`);
  });
  
  if (results.length > 20) {
    console.log(`... and ${results.length - 20} more results`);
  }
  
  return report;
}

// Types for the fuzz test results
interface FuzzResult {
  input: string;
  output: string;
  index: number;
}

interface FuzzError {
  input: string;
  error: string;
  index: number;
}

interface SuspiciousResult extends FuzzResult {
  reason: string;
}

// Function to analyze patterns in results
function analyzePatterns(results: FuzzResult[]) {
  console.log('\n🔍 Pattern Analysis:');
  console.log('='.repeat(50));
  
  // Group by output to find potential over-normalization
  const outputGroups: Record<string, string[]> = {};
  results.forEach(result => {
    if (!outputGroups[result.output]) {
      outputGroups[result.output] = [];
    }
    outputGroups[result.output].push(result.input);
  });
  
  // Find groups with multiple different inputs
  const multiInputGroups = Object.entries(outputGroups)
    .filter(([output, inputs]) => inputs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  if (multiInputGroups.length > 0) {
    console.log('\n📦 Ingredients that normalize to the same result:');
    multiInputGroups.slice(0, 10).forEach(([output, inputs]) => {
      console.log(`\n"${output}":`);
      inputs.forEach(input => console.log(`  - "${input}"`));
    });
  }
  
  // Find very long outputs
  const longOutputs = results.filter(r => r.output.length > 50);
  if (longOutputs.length > 0) {
    console.log('\n📏 Very long outputs (>50 chars):');
    longOutputs.slice(0, 5).forEach(result => {
      console.log(`"${result.input}" → "${result.output}" (${result.output.length} chars)`);
    });
  }
  
  // Find very short outputs
  const shortOutputs = results.filter(r => r.output.length < 3 && r.input.length > 5);
  if (shortOutputs.length > 0) {
    console.log('\n📏 Very short outputs (<3 chars):');
    shortOutputs.slice(0, 5).forEach(result => {
      console.log(`"${result.input}" → "${result.output}" (${result.output.length} chars)`);
    });
  }
}

// Run the tests
if (require.main === module) {
  const report = runFuzzTests();
  analyzePatterns(report.results);
  
  console.log('\n✅ Fuzz testing complete!');
  console.log('Review the results above and add any problematic cases to your unit tests.');
}

export { runFuzzTests, analyzePatterns, allIngredients };
