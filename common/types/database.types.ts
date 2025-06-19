export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      recipes: {
        Row: {
          id: string
          created_at: string
          title: string
          servings: number
          user_id?: string
        }
        Insert: {
          id?: string
          title: string
          servings: number
          user_id?: string
        }
        Update: {
          id?: string
          title?: string
          servings?: number
          user_id?: string
        }
      }
      ingredients: {
        Row: {
          id: string
          recipe_id: string
          name: string
          amount: string
          unit: string
          adjustable: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipe_id: string
          name: string
          amount: string
          unit: string
          adjustable: boolean
        }
        Update: {
          recipe_id?: string
          name?: string
          amount?: string
          unit?: string
          adjustable?: boolean
        }
      }
      substitutions: {
        Row: {
          id: string
          ingredient_id: string
          name: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          ingredient_id: string
          name: string
          description: string
        }
        Update: {
          ingredient_id?: string
          name?: string
          description?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
