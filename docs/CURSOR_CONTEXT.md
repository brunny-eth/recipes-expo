# Cursor Context

This file provides guidance to Cursor about the codebase structure, patterns to follow, and best practices.

## General Principles
- **Stateless**: All Express routes are serverless; no in-memory persistence across requests.
- **Modularity**: Use `/api/routes/<feature>.ts` for related endpoints.
- **Error Handling**: Return meaningful JSON errors and HTTP status codes.
- **Write Tests as New Code is Implemented, when needed**: Don't delete tests because they fail; problem-solve the test or the function

## File Structure
```
/api/
  index.ts          # Express app entry point
  lib/
    supabase.ts     # Supabase client initialization
  routes/
    recipes.ts      # /api/recipes endpoints
    ingredients.ts  # /api/ingredients endpoints
/types/
  database.types.ts # Supabase table typings
/app/
  (tabs)/          # Expo Router tab screens
  recipe/          # Ingredients & substitution UI
/components/       # Reusable UI components
/constants/        # Theme, colors
/hooks/            # Custom hooks
```

## Patterns
- **Routing**: `app.use('/api/<route>', <router>)`
- **Supabase Queries**: Use typed `.from('<table>')` with `.select()`
- **Express Handlers**: `async (req, res) => { try { … } catch (err) { res.status(500).json({ error: err.message }) } }`
- **Environment**: Access via `process.env.SUPABASE_URL`, `process.env.SUPABASE_ANON_KEY`

## Cursor Rules Mapping
This mirrors your `.cursorrules`:

| Pattern             | Type      | Framework      |
|---------------------|-----------|----------------|
| `app/**/*.ts(x)`    | frontend  | react-native   |
| `components/**`     | frontend  | react-native   |
| `hooks/**`          | frontend  | react           |
| `api/**/*.ts`       | backend   | express         |
| `api/lib/**`        | backend   | supabase        |
| `api/routes/**`     | backend   | express routers |
| `api/types/**`      | shared    | typescript      | 