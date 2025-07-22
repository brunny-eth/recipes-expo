import { convertUnits, availableUnits, Unit } from './units';
import { abbreviateUnit } from './format';
import { formatAmountNumber } from './recipeUtils';

export interface GroceryListItem {
  id: string;
  item_name: string;
  original_ingredient_text: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  grocery_category: string | null;
  is_checked: boolean;
  order_index: number;
  recipe_id: number | null;
  user_saved_recipe_id: string | null;
  source_recipe_title: string;
  shopping_list_id: string;
}

export interface AggregatedItem {
  item_name: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  display_text: string;
  source_count: number;
  source_recipes: string[];
  combined_items: GroceryListItem[];
}

export interface CategorizedGroceryItems {
  [category: string]: AggregatedItem[];
}

export interface GroceryListSummary {
  items: CategorizedGroceryItems;
  totalItems: number;
  totalCategories: number;
  shoppingListName?: string;
}

/**
 * Aggregates grocery list items by combining similar items and converting units
 */
export function aggregateGroceryItems(items: GroceryListItem[]): CategorizedGroceryItems {
  console.log('[groceryAggregation] 🔄 Starting aggregateGroceryItems with', items.length, 'items');
  const aggregatedItems: CategorizedGroceryItems = {};
  
  // Group items by category first
  const itemsByCategory: { [category: string]: GroceryListItem[] } = {};
  
  for (const item of items) {
    const category = item.grocery_category || 'Other';
    console.log(`[groceryAggregation] 📦 Processing item "${item.item_name}" into category "${category}"`);
    if (!itemsByCategory[category]) {
      itemsByCategory[category] = [];
    }
    itemsByCategory[category].push(item);
  }
  
  // Process each category
  for (const [category, categoryItems] of Object.entries(itemsByCategory)) {
    console.log(`[groceryAggregation] 🗂️ Aggregating category "${category}" with ${categoryItems.length} items`);
    aggregatedItems[category] = aggregateItemsInCategory(categoryItems);
  }
  
  console.log('[groceryAggregation] ✅ Completed aggregation:', Object.keys(aggregatedItems).length, 'categories');
  return aggregatedItems;
}

/**
 * Aggregates items within a specific category
 */
function aggregateItemsInCategory(items: GroceryListItem[]): AggregatedItem[] {
  console.log('[groceryAggregation] 🔄 Starting aggregateItemsInCategory with', items.length, 'items');
  const itemMap = new Map<string, AggregatedItem>();
  
  for (const item of items) {
    const key = normalizeItemName(item.item_name);
    console.log(`[groceryAggregation] 📝 Processing "${item.item_name}" (normalized: "${key}")`);
    
    if (itemMap.has(key)) {
      // Combine with existing item
      const existingItem = itemMap.get(key)!;
      console.log(`[groceryAggregation] 🔗 Combining with existing item "${existingItem.item_name}"`);
      const combinedAmount = combineQuantities(
        existingItem.quantity_amount,
        existingItem.quantity_unit,
        item.quantity_amount,
        item.quantity_unit
      );
      
      existingItem.quantity_amount = combinedAmount.amount;
      existingItem.quantity_unit = combinedAmount.unit;
      existingItem.display_text = formatItemDisplayText(
        existingItem.item_name,
        existingItem.quantity_amount,
        existingItem.quantity_unit
      );
      existingItem.source_count += 1;
      existingItem.source_recipes.push(item.source_recipe_title);
      existingItem.combined_items.push(item);
      
      console.log(`[groceryAggregation] ✨ Combined result:`, {
        item_name: existingItem.item_name,
        quantity: existingItem.quantity_amount,
        unit: existingItem.quantity_unit,
        sources: existingItem.source_count
      });
    } else {
      // Create new aggregated item
      console.log(`[groceryAggregation] ➕ Creating new aggregated item for "${item.item_name}"`);
      const aggregatedItem: AggregatedItem = {
        item_name: item.item_name,
        quantity_amount: item.quantity_amount,
        quantity_unit: item.quantity_unit,
        display_text: formatItemDisplayText(
          item.item_name,
          item.quantity_amount,
          item.quantity_unit
        ),
        source_count: 1,
        source_recipes: [item.source_recipe_title],
        combined_items: [item]
      };
      
      itemMap.set(key, aggregatedItem);
    }
  }
  
  // Convert map to array and sort by item name
  const result = Array.from(itemMap.values()).sort((a, b) => 
    a.item_name.localeCompare(b.item_name)
  );
  
  console.log('[groceryAggregation] ✅ Completed category aggregation:', result.length, 'unique items');
  return result;
}

/**
 * Normalizes item names for comparison (handles plurals, case, etc.)
 */
function normalizeItemName(name: string): string {
  let normalized = name.toLowerCase().trim();
  
  // Remove common adjectives and descriptors
  normalized = normalized.replace(/\b(large|small|medium|fresh|frozen|organic|dried|whole|ground|chopped|diced|minced|sliced)\b/g, '');
  
  // Handle plurals - simple approach
  if (normalized.endsWith('es')) {
    normalized = normalized.slice(0, -2);
  } else if (normalized.endsWith('s') && !normalized.endsWith('ss')) {
    normalized = normalized.slice(0, -1);
  }
  
  // Handle common variations
  normalized = normalized.replace(/\btomato\b/g, 'tomato');
  normalized = normalized.replace(/\bonion\b/g, 'onion');
  normalized = normalized.replace(/\bgarlic\b/g, 'garlic');
  
  return normalized.trim();
}

/**
 * Combines quantities of two items, attempting unit conversion if possible
 */
function combineQuantities(
  amount1: number | null,
  unit1: string | null,
  amount2: number | null,
  unit2: string | null
): { amount: number | null; unit: string | null } {
  console.log('[groceryAggregation] 🔢 Combining quantities:', { amount1, unit1, amount2, unit2 });
  
  // If either amount is null, return the non-null one or null
  if (amount1 === null && amount2 === null) {
    return { amount: null, unit: null };
  }
  if (amount1 === null) {
    return { amount: amount2, unit: unit2 };
  }
  if (amount2 === null) {
    return { amount: amount1, unit: unit1 };
  }
  
  // If units are the same, just add amounts
  if (unit1 === unit2) {
    const result = { amount: amount1 + amount2, unit: unit1 };
    console.log('[groceryAggregation] ➕ Simple addition:', result);
    return result;
  }
  
  // Try to convert units and combine
  if (unit1 && unit2) {
    try {
      const convertedAmount = convertUnits(amount2, unit2 as Unit, unit1 as Unit);
      if (convertedAmount !== null) {
        const result = { amount: amount1 + convertedAmount, unit: unit1 };
        console.log('[groceryAggregation] 🔄 Unit conversion successful:', result);
        return result;
      }
    } catch (error) {
      // Conversion failed, keep them separate
      console.warn(`[groceryAggregation] ⚠️ Could not convert ${unit2} to ${unit1}:`, error);
    }
  }
  
  // If conversion fails, return the larger amount or first one
  const result = amount1 >= amount2 
    ? { amount: amount1, unit: unit1 }
    : { amount: amount2, unit: unit2 };
  console.log('[groceryAggregation] ⚖️ Using larger amount:', result);
  return result;
}

/**
 * Formats an item for display
 */
function formatItemDisplayText(
  name: string,
  amount: number | null,
  unit: string | null
): string {
  if (amount === null) {
    return name;
  }
  
  const formattedAmount = formatAmountNumber(amount);
  const formattedUnit = unit ? abbreviateUnit(unit) : '';
  
  if (formattedUnit) {
    return `${formattedAmount} ${formattedUnit} ${name}`;
  } else {
    return `${formattedAmount} ${name}`;
  }
}

/**
 * Generates a grocery list summary from raw items
 */
export function generateGroceryListSummary(
  items: GroceryListItem[],
  shoppingListName?: string
): GroceryListSummary {
  console.log('[groceryAggregation] 📊 Generating summary for', items.length, 'items');
  const aggregatedItems = aggregateGroceryItems(items);
  
  const totalItems = Object.values(aggregatedItems).reduce(
    (sum, categoryItems) => sum + categoryItems.length,
    0
  );
  
  const totalCategories = Object.keys(aggregatedItems).length;
  
  const result = {
    items: aggregatedItems,
    totalItems,
    totalCategories,
    shoppingListName
  };
  
  console.log('[groceryAggregation] 📋 Summary generated:', {
    totalItems,
    totalCategories,
    categories: Object.keys(aggregatedItems)
  });
  
  return result;
}

/**
 * Generates markdown export of grocery list
 */
export function generateGroceryListMarkdown(summary: GroceryListSummary): string {
  const { items, shoppingListName } = summary;
  
  let markdown = '';
  
  // Add title
  if (shoppingListName) {
    markdown += `# ${shoppingListName}\n\n`;
  } else {
    markdown += `# Grocery List\n\n`;
  }
  
  // Add date
  markdown += `*Generated on ${new Date().toLocaleDateString()}*\n\n`;
  
  // Add items by category
  for (const [category, categoryItems] of Object.entries(items)) {
    if (categoryItems.length === 0) continue;
    
    markdown += `## ${category}\n\n`;
    
    for (const item of categoryItems) {
      const checkbox = item.combined_items.every(ci => ci.is_checked) ? '[x]' : '[ ]';
      markdown += `- ${checkbox} ${item.display_text}`;
      
      if (item.source_count > 1) {
        markdown += ` *(from ${item.source_count} recipes)*`;
      }
      
      markdown += '\n';
    }
    
    markdown += '\n';
  }
  
  return markdown;
}

/**
 * Sorts categories in a logical grocery store order
 */
export function sortGroceryCategories(categories: string[]): string[] {
  const preferredOrder = [
    'Produce',
    'Meat & Seafood',
    'Dairy & Eggs',
    'Pantry',
    'Bakery',
    'Frozen',
    'Spices & Herbs',
    'Condiments & Sauces',
    'Beverages',
    'Snacks',
    'Health & Personal Care',
    'Other'
  ];
  
  const sorted = [...categories].sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);
    
    // If both are in preferred order, sort by order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in preferred order, it comes first
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in preferred order, sort alphabetically
    return a.localeCompare(b);
  });
  
  return sorted;
} 