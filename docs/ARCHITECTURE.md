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
- **Database**: Supabase (PostgreSQL)
  - Tables: `recipes`, `ingredients`, `substitutions`
  - Relationships via foreign keys
- **Deployment**: Vercel serverless functions (auto-scaling, zero maintenance) 