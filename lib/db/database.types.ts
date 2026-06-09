export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          category: string
          created_at: string
          data: Json
          id: string
          is_active: boolean
          notes: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          data: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          data?: Json
          id?: string
          is_active?: boolean
          notes?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      iterations: {
        Row: {
          created_at: string
          id: string
          parent_render_url: string
          project_id: string
          prompt_used: string | null
          provider_used: string
          result_url: string | null
          user_request: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_render_url: string
          project_id: string
          prompt_used?: string | null
          provider_used: string
          result_url?: string | null
          user_request: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_render_url?: string
          project_id?: string
          prompt_used?: string | null
          provider_used?: string
          result_url?: string | null
          user_request?: string
        }
        Relationships: [
          {
            foreignKeyName: "iterations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          alterations: Json | null
          created_at: string
          current_render_url: string | null
          id: string
          room_type: string
          source_image_url: string | null
          style_id: string
          updated_at: string
          user_id: string | null
          user_instructions: Json | null
          vision_output: Json | null
        }
        Insert: {
          alterations?: Json | null
          created_at?: string
          current_render_url?: string | null
          id?: string
          room_type: string
          source_image_url?: string | null
          style_id: string
          updated_at?: string
          user_id?: string | null
          user_instructions?: Json | null
          vision_output?: Json | null
        }
        Update: {
          alterations?: Json | null
          created_at?: string
          current_render_url?: string | null
          id?: string
          room_type?: string
          source_image_url?: string | null
          style_id?: string
          updated_at?: string
          user_id?: string | null
          user_instructions?: Json | null
          vision_output?: Json | null
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          conditions: Json
          id: string
          notes: string | null
          prompt_id: string
          provider: string
          purpose: string
          saved_at: string
          saved_by: string | null
          slug: string
          template: string
          version: number
        }
        Insert: {
          conditions: Json
          id?: string
          notes?: string | null
          prompt_id: string
          provider: string
          purpose: string
          saved_at?: string
          saved_by?: string | null
          slug: string
          template: string
          version: number
        }
        Update: {
          conditions?: Json
          id?: string
          notes?: string | null
          prompt_id?: string
          provider?: string
          purpose?: string
          saved_at?: string
          saved_by?: string | null
          slug?: string
          template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          conditions: Json
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          provider: string
          purpose: string
          slug: string
          template: string
          updated_at: string
          version: number
        }
        Insert: {
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider: string
          purpose: string
          slug: string
          template: string
          updated_at?: string
          version?: number
        }
        Update: {
          conditions?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          provider?: string
          purpose?: string
          slug?: string
          template?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          items: Json
          project_id: string
          score_foyer: Json | null
          total_estimated: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          project_id: string
          score_foyer?: Json | null
          total_estimated?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          project_id?: string
          score_foyer?: Json | null
          total_estimated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

// ================================================================
// Domain types (typed data fields from JSONB columns)
// ================================================================

export type RoomType = "salon" | "chambre"

export type AmbianceData = {
  name: string
  description: string
  palette: string[]
  materials: string[]
  mood: string
}

export type RoomDefaultsData = {
  label: string
  expectedFurniture: string[]
  englishFurniture: string
}

export type FloorPresetData = {
  label: string
  description: string
}

export type WallPaletteData = {
  label: string
  hex: string
  description: string
}

export type PromptPurpose = "generation" | "iteration" | "detection" | "audit" | "alterations"
export type PromptProvider = "nano_banana" | "flux_kontext" | "gemini_vision" | "seedream"
export type AssetCategory = "ambiance" | "room_defaults" | "floor_preset" | "wall_palette"

// Convenience row aliases
export type DbProject = Tables<"projects">
export type DbIteration = Tables<"iterations">
export type DbPrompt = Tables<"prompts">
export type DbPromptVersion = Tables<"prompt_versions">
export type DbAsset = Tables<"assets">
export type DbShoppingList = Tables<"shopping_lists">
