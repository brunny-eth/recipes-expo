-- Table to store the checked state of shopping list items for each user.
-- This allows the checked state to persist across sessions and app loads.

CREATE TABLE IF NOT EXISTS public.user_shopping_list_item_states (
  -- The user this state belongs to.
  user_id UUID NOT NULL,
  
  -- A normalized (lowercase, singular) version of the ingredient name.
  -- This acts as a stable identifier for the ingredient.
  -- e.g., "all-purpose flour", "flour" -> "flour"
  normalized_item_name TEXT NOT NULL,
  
  -- Whether the user has checked this item off their list.
  is_checked BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  -- Foreign key to the users table to ensure data integrity.
  CONSTRAINT user_shopping_list_item_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The primary key ensures that there is only one checked-state record
  -- per user per normalized ingredient name.
  PRIMARY KEY (user_id, normalized_item_name)
);

-- Enable Row Level Security
ALTER TABLE public.user_shopping_list_item_states ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
-- Users can only see and manage their own item states.
CREATE POLICY "Allow individual read access" ON public.user_shopping_list_item_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow individual insert access" ON public.user_shopping_list_item_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow individual update access" ON public.user_shopping_list_item_states FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow individual delete access" ON public.user_shopping_list_item_states FOR DELETE USING (auth.uid() = user_id);

-- Trigger to automatically update the 'updated_at' timestamp
CREATE OR REPLACE TRIGGER set_timestamp
BEFORE UPDATE ON public.user_shopping_list_item_states
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Add comments to the table and columns for clarity in database inspection tools.
COMMENT ON TABLE public.user_shopping_list_item_states IS 'Stores the persistent checked/unchecked state of items on a user''s grocery list.';
COMMENT ON COLUMN public.user_shopping_list_item_states.normalized_item_name IS 'The lowercase, singular, and trimmed name of the grocery item used for aggregation and identification.'; 