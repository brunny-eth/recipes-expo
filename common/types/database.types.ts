import { CombinedParsedRecipe } from './recipes';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      launch_waitlist: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      processed_recipes_cache: {
        Row: {
          created_at: string | null
          embedding: number[] | null
          id: number
          is_user_modified: boolean | null
          last_processed_at: string | null
          normalized_url: string | null
          parent_recipe_id: number | null
          recipe_data: CombinedParsedRecipe | null
          source_type: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          embedding?: number[] | null
          id?: number
          is_user_modified?: boolean | null
          last_processed_at?: string | null
          normalized_url?: string | null
          parent_recipe_id?: number | null
          recipe_data?: CombinedParsedRecipe | null
          source_type?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          embedding?: number[] | null
          id?: number
          is_user_modified?: boolean | null
          last_processed_at?: string | null
          normalized_url?: string | null
          parent_recipe_id?: number | null
          recipe_data?: CombinedParsedRecipe | null
          source_type?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_recipes_cache_parent_recipe_id_fkey"
            columns: ["parent_recipe_id"]
            isOneToOne: false
            referencedRelation: "processed_recipes_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          app_version: string | null
          created_at: string | null
          email: string
          id: string
          message: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
        }
        Relationships: []
      }
      user_mise_recipes: {
        Row: {
          applied_changes: Json
          created_at: string | null
          display_order: number | null
          final_yield: string | null
          id: number
          is_completed: boolean | null
          original_recipe_data: Json | null
          original_recipe_id: number
          planned_date: string | null
          prepared_recipe_data: Json
          title_override: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_changes: Json
          created_at?: string | null
          display_order?: number | null
          final_yield?: string | null
          id?: number
          is_completed?: boolean | null
          original_recipe_data?: Json | null
          original_recipe_id: number
          planned_date?: string | null
          prepared_recipe_data: Json
          title_override?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_changes?: Json
          created_at?: string | null
          display_order?: number | null
          final_yield?: string | null
          id?: number
          is_completed?: boolean | null
          original_recipe_data?: Json | null
          original_recipe_id?: number
          planned_date?: string | null
          prepared_recipe_data?: Json
          title_override?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mise_recipes_original_recipe_id_fkey"
            columns: ["original_recipe_id"]
            isOneToOne: false
            referencedRelation: "processed_recipes_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      user_saved_folders: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          icon: string | null
          id: number
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: number
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string | null
          id?: number
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_saved_recipes: {
        Row: {
          applied_changes: Json | null
          base_recipe_id: number
          created_at: string | null
          display_order: number | null
          folder_id: number | null
          id: string
          notes: string | null
          title_override: string | null
          user_id: string
        }
        Insert: {
          applied_changes?: Json | null
          base_recipe_id: number
          created_at?: string | null
          display_order?: number | null
          folder_id?: number | null
          id?: string
          notes?: string | null
          title_override?: string | null
          user_id: string
        }
        Update: {
          applied_changes?: Json | null
          base_recipe_id?: number
          created_at?: string | null
          display_order?: number | null
          folder_id?: number | null
          id?: string
          notes?: string | null
          title_override?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_saved_recipes_base_recipe_id_fkey"
            columns: ["base_recipe_id"]
            isOneToOne: false
            referencedRelation: "processed_recipes_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_saved_recipes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "user_saved_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          allergens: string[] | null
          created_at: string | null
          dietary_preferences: string[] | null
          has_used_free_recipe: boolean | null
          is_pro: boolean | null
          user_id: string
        }
        Insert: {
          allergens?: string[] | null
          created_at?: string | null
          dietary_preferences?: string[] | null
          has_used_free_recipe?: boolean | null
          is_pro?: boolean | null
          user_id: string
        }
        Update: {
          allergens?: string[] | null
          created_at?: string | null
          dietary_preferences?: string[] | null
          has_used_free_recipe?: boolean | null
          is_pro?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_shopping_list_item_states: {
        Row: {
          created_at: string | null
          is_checked: boolean
          normalized_item_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          is_checked?: boolean
          normalized_item_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          is_checked?: boolean
          normalized_item_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_cached_recipe_by_url: {
        Args: { p_normalized_url: string }
        Returns: {
          created_at: string
          id: number
          original_url: string
          recipe_data: CombinedParsedRecipe | null
          title: string
        }[]
      }
      get_random_recipes: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string | null
          embedding: number[] | null
          id: number
          is_user_modified: boolean | null
          last_processed_at: string | null
          normalized_url: string | null
          parent_recipe_id: number | null
          recipe_data: CombinedParsedRecipe | null
          source_type: string | null
          updated_at: string | null
          url: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      match_recipes_by_embedding: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          id: number
          recipe_data: CombinedParsedRecipe | null
          similarity: number
        }[]
      }
      reorder_mise_recipes: {
        Args: { new_order: Json; user_id_param: string }
        Returns: number
      }
      sample_rows_selected: {
        Args: { limit_rows?: number }
        Returns: {
          sample_rows: Json
          table_name: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
