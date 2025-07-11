-- Create RPC function for fast cache lookups by normalized URL
-- This function is optimized for speed and will be called by the frontend
-- for instant feedback on cached recipes

CREATE OR REPLACE FUNCTION get_cached_recipe_by_url(p_normalized_url TEXT)
RETURNS TABLE(
    id BIGINT,
    recipe_data JSONB,
    title TEXT,
    original_url TEXT,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
STABLE -- Mark as STABLE for better performance (read-only function)
AS $$
BEGIN
    -- Only return URL-based recipes (not text recipes or user-modified ones)
    -- Use the normalized_url column for exact match lookup
    RETURN QUERY
    SELECT 
        prc.id,
        prc.recipe_data,
        COALESCE(prc.recipe_data->>'title', 'Untitled Recipe') as title,
        prc.url as original_url,
        prc.created_at
    FROM processed_recipes_cache prc
    WHERE prc.normalized_url = p_normalized_url
      AND prc.source_type IN ('url', 'video')  -- Only URL-based or video-based recipes
    ORDER BY prc.created_at DESC  -- Get most recent if duplicates exist
    LIMIT 1;
END;
$$;

-- Add a comment for documentation
COMMENT ON FUNCTION get_cached_recipe_by_url(TEXT) IS 
'Fast lookup for cached recipes by normalized URL. Returns recipe data for instant frontend feedback. Only searches URL-based or video-based recipes (not text or user-modified entries).';

-- Test the function with a sample call (you can modify this URL to test)
-- SELECT * FROM get_cached_recipe_by_url('https://example.com/recipe'); 