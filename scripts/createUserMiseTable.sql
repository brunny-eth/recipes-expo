-- Create user_mise_recipes table for storing prepared/staged recipes
-- This is different from user_saved_recipes (which is a recipe collection)
-- This table stores recipes that are actively prepared for cooking with specific modifications

CREATE TABLE user_mise_recipes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_recipe_id INTEGER NOT NULL REFERENCES processed_recipes_cache(id) ON DELETE CASCADE,
  
  -- Display and organization
  title_override TEXT, -- Custom name like "Sunday Dinner Pasta"
  planned_date DATE,   -- When user plans to cook this
  display_order INTEGER DEFAULT 0, -- User-controlled ordering
  
  -- Recipe data (final processed version ready for cooking)
  prepared_recipe_data JSONB NOT NULL, -- Full recipe with scaled ingredients, rewritten instructions
  final_yield TEXT,    -- Final yield after scaling (e.g., "Serves 6" vs original "Serves 4")
  
  -- Metadata about changes made
  applied_changes JSONB NOT NULL, -- { ingredientChanges: [...], scalingFactor: 2.0 }
  
  -- Status and timestamps
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_mise_recipes_user_id ON user_mise_recipes(user_id);
CREATE INDEX idx_user_mise_recipes_user_id_completed ON user_mise_recipes(user_id, is_completed);
CREATE INDEX idx_user_mise_recipes_planned_date ON user_mise_recipes(planned_date) WHERE planned_date IS NOT NULL;

-- RLS (Row Level Security)
ALTER TABLE user_mise_recipes ENABLE ROW LEVEL SECURITY;

-- Users can only see their own mise recipes
CREATE POLICY "Users can view own mise recipes" ON user_mise_recipes
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own mise recipes
CREATE POLICY "Users can insert own mise recipes" ON user_mise_recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own mise recipes
CREATE POLICY "Users can update own mise recipes" ON user_mise_recipes
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own mise recipes
CREATE POLICY "Users can delete own mise recipes" ON user_mise_recipes
  FOR DELETE USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_mise_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_mise_recipes_updated_at
  BEFORE UPDATE ON user_mise_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_mise_recipes_updated_at();

-- Add helpful comments
COMMENT ON TABLE user_mise_recipes IS 'Stores recipes that users have prepared/staged for cooking with specific modifications (scaling, substitutions, etc). Different from user_saved_recipes which is a general recipe collection.';
COMMENT ON COLUMN user_mise_recipes.title_override IS 'Custom display name for this prepared recipe (e.g. "Sunday Dinner Pasta")';
COMMENT ON COLUMN user_mise_recipes.planned_date IS 'Date when user plans to cook this recipe';
COMMENT ON COLUMN user_mise_recipes.prepared_recipe_data IS 'Complete recipe object with scaled ingredients and rewritten instructions, ready for cooking';
COMMENT ON COLUMN user_mise_recipes.applied_changes IS 'Metadata about what changes were made: scaling factor, ingredient substitutions, etc';
COMMENT ON COLUMN user_mise_recipes.is_completed IS 'Whether user has marked this recipe as cooked/completed'; 