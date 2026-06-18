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
      foyer_projects: {
        Row: {
          id: string
          user_id: string | null
          anon_id: string | null
          created_at: string
          updated_at: string
          data: Json
        }
        Insert: {
          id: string
          user_id?: string | null
          anon_id?: string | null
          created_at?: string
          updated_at?: string
          data: Json
        }
        Update: {
          id?: string
          user_id?: string | null
          anon_id?: string | null
          created_at?: string
          updated_at?: string
          data?: Json
        }
        Relationships: []
      }
      ai_calls: {
        Row: {
          id: string
          project_id: string | null
          iteration_id: string | null
          step: string
          provider: string
          model: string | null
          input_tokens: number | null
          output_tokens: number | null
          images_in: number
          images_out: number
          api_requests: number
          unit_cost: number | null
          total_cost: number
          latency_ms: number | null
          success: boolean
          error: string | null
          request_payload: Json | null
          response_payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          iteration_id?: string | null
          step: string
          provider: string
          model?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
          images_in?: number
          images_out?: number
          api_requests?: number
          unit_cost?: number | null
          total_cost?: number
          latency_ms?: number | null
          success?: boolean
          error?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          iteration_id?: string | null
          step?: string
          provider?: string
          model?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
          images_in?: number
          images_out?: number
          api_requests?: number
          unit_cost?: number | null
          total_cost?: number
          latency_ms?: number | null
          success?: boolean
          error?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      diy_actions: {
        Row: {
          id: string
          slug: string
          label: string
          label_en: string | null
          applies_to_categories: string[]
          requires: Json
          excludes: Json
          qty_formula: string | null
          qty_unit: string | null
          style_affinity: Json
          supplies_template: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          label: string
          label_en?: string | null
          applies_to_categories?: string[]
          requires?: Json
          excludes?: Json
          qty_formula?: string | null
          qty_unit?: string | null
          style_affinity?: Json
          supplies_template?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          label?: string
          label_en?: string | null
          applies_to_categories?: string[]
          requires?: Json
          excludes?: Json
          qty_formula?: string | null
          qty_unit?: string | null
          style_affinity?: Json
          supplies_template?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      pipeline_logs: {
        Row: {
          id: string
          created_at: string
          project_id: string
          event: string
          step: string | null
          provider: string | null
          duration_ms: number | null
          render_url: string | null
          audit_pass: boolean | null
          audit_scores: Json | null
          audit_issues: Json | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          project_id: string
          event: string
          step?: string | null
          provider?: string | null
          duration_ms?: number | null
          render_url?: string | null
          audit_pass?: boolean | null
          audit_scores?: Json | null
          audit_issues?: Json | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          project_id?: string
          event?: string
          step?: string | null
          provider?: string | null
          duration_ms?: number | null
          render_url?: string | null
          audit_pass?: boolean | null
          audit_scores?: Json | null
          audit_issues?: Json | null
          metadata?: Json | null
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
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          plan: "neophyte" | "expert" | "pro"
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          current_period_end: string | null
          first_free_used: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          plan?: "neophyte" | "expert" | "pro"
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          current_period_end?: string | null
          first_free_used?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          plan?: "neophyte" | "expert" | "pro"
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          current_period_end?: string | null
          first_free_used?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_wallet: {
        Row: {
          user_id: string
          balance: number
          total_purchased: number
          total_consumed: number
          updated_at: string
        }
        Insert: {
          user_id: string
          balance?: number
          total_purchased?: number
          total_consumed?: number
          updated_at?: string
        }
        Update: {
          user_id?: string
          balance?: number
          total_purchased?: number
          total_consumed?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          delta: number
          reason: string
          related_project_id: string | null
          stripe_payment_intent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          delta: number
          reason: string
          related_project_id?: string | null
          stripe_payment_intent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          delta?: number
          reason?: string
          related_project_id?: string | null
          stripe_payment_intent_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      pro_properties: {
        Row: { id: string; owner_id: string; address: string; property_type: string; surface_m2: number | null; notes: string | null; status: string; created_at: string; updated_at: string }
        Insert: { id?: string; owner_id: string; address: string; property_type: string; surface_m2?: number | null; notes?: string | null; status?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; owner_id?: string; address?: string; property_type?: string; surface_m2?: number | null; notes?: string | null; status?: string; updated_at?: string }
        Relationships: []
      }
      pro_property_rooms: {
        Row: { id: string; property_id: string; name: string; room_type: string; photo_urls: string[]; primary_photo_url: string | null; sort_order: number; created_at: string }
        Insert: { id?: string; property_id: string; name: string; room_type: string; photo_urls?: string[]; primary_photo_url?: string | null; sort_order?: number; created_at?: string }
        Update: { id?: string; property_id?: string; name?: string; room_type?: string; photo_urls?: string[]; primary_photo_url?: string | null; sort_order?: number }
        Relationships: []
      }
      pro_generation_jobs: {
        Row: { id: string; property_id: string; user_id: string; mode: string; rooms_selected: string[]; ambiances_selected: string[]; global_constraints: string | null; status: string; total_renders: number; completed_renders: number; failed_renders: number; started_at: string | null; completed_at: string | null; created_at: string }
        Insert: { id?: string; property_id: string; user_id: string; mode?: string; rooms_selected: string[]; ambiances_selected: string[]; global_constraints?: string | null; status?: string; total_renders: number; completed_renders?: number; failed_renders?: number; started_at?: string | null; completed_at?: string | null; created_at?: string }
        Update: { status?: string; completed_renders?: number; failed_renders?: number; started_at?: string | null; completed_at?: string | null }
        Relationships: []
      }
      pro_renders: {
        Row: { id: string; job_id: string; room_id: string; ambiance_slug: string; source_photo_url: string; render_url: string | null; status: string; error_message: string | null; is_favorite: boolean; alterations: unknown; created_at: string; completed_at: string | null }
        Insert: { id?: string; job_id: string; room_id: string; ambiance_slug: string; source_photo_url: string; render_url?: string | null; status?: string; error_message?: string | null; is_favorite?: boolean; alterations?: unknown; created_at?: string; completed_at?: string | null }
        Update: { render_url?: string | null; status?: string; error_message?: string | null; is_favorite?: boolean; alterations?: unknown; completed_at?: string | null }
        Relationships: []
      }
      pro_templates: {
        Row: { id: string; owner_id: string; name: string; description: string | null; ambiance_slugs: string[]; custom_constraints: unknown; created_at: string }
        Insert: { id?: string; owner_id: string; name: string; description?: string | null; ambiance_slugs: string[]; custom_constraints?: unknown; created_at?: string }
        Update: { name?: string; description?: string | null; ambiance_slugs?: string[]; custom_constraints?: unknown }
        Relationships: []
      }
      pro_clients: {
        Row: { id: string; owner_id: string; name: string; email: string | null; phone: string | null; notes: string | null; created_at: string }
        Insert: { id?: string; owner_id: string; name: string; email?: string | null; phone?: string | null; notes?: string | null; created_at?: string }
        Update: { name?: string; email?: string | null; phone?: string | null; notes?: string | null }
        Relationships: []
      }
      ai_pricing: {
        Row: {
          id: string
          provider: string
          model: string | null
          per_1m_input_tokens: number | null
          per_1m_output_tokens: number | null
          per_image_in: number | null
          per_image_out: number | null
          per_request: number | null
          per_1k_embeddings: number | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider: string
          model?: string | null
          per_1m_input_tokens?: number | null
          per_1m_output_tokens?: number | null
          per_image_in?: number | null
          per_image_out?: number | null
          per_request?: number | null
          per_1k_embeddings?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          provider?: string
          model?: string | null
          per_1m_input_tokens?: number | null
          per_1m_output_tokens?: number | null
          per_image_in?: number | null
          per_image_out?: number | null
          per_request?: number | null
          per_1k_embeddings?: number | null
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      pro_share_links: {
        Row: { id: string; job_id: string; slug: string; client_id: string | null; view_count: number; expires_at: string | null; created_at: string }
        Insert: { id?: string; job_id: string; slug: string; client_id?: string | null; view_count?: number; expires_at?: string | null; created_at?: string }
        Update: { view_count?: number; expires_at?: string | null }
        Relationships: []
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
