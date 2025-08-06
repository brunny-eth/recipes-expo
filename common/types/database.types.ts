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
      user_saved_folders: {
        Row: {
          id: number;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name: string;
          color?: string;
          icon?: string;
          display_order?: number;
        };
        Update: {
          name?: string;
          color?: string;
          icon?: string;
          display_order?: number;
        };
      };
      user_saved_recipes: {
        Row: {
          id: number;
          user_id: string;
          base_recipe_id: number;
          folder_id: number | null;
          title_override: string | null;
          applied_changes: Json | null;
          original_recipe_data: Json | null;
          display_order: number;
          created_at: string;
          updated_at?: string;
        };
        Insert: {
          user_id: string;
          base_recipe_id: number;
          folder_id?: number | null;
          title_override?: string | null;
          applied_changes?: Json | null;
          original_recipe_data?: Json | null;
          display_order?: number;
        };
        Update: {
          folder_id?: number | null;
          title_override?: string | null;
          applied_changes?: Json | null;
          original_recipe_data?: Json | null;
          display_order?: number;
        };
      };
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
      user_feedback: {
        Row: {
          id: string
          message: string
          email: string | null
          app_version: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message: string
          email?: string | null
          app_version?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message?: string
          email?: string | null
          app_version?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_random_recipes: {
        Args: Record<string, never>;
        Returns: Array<{
          id: number;
          recipe_data: Json;
        }>;
      };
    }
    Enums: {
      [_ in never]: never
    }
  }
}
