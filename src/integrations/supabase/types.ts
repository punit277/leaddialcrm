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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      call_logs: {
        Row: {
          agent_id: string
          called_at: string
          follow_up_date: string | null
          id: string
          lead_id: string
          notes: string | null
          response: string
        }
        Insert: {
          agent_id: string
          called_at?: string
          follow_up_date?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          response: string
        }
        Update: {
          agent_id?: string
          called_at?: string
          follow_up_date?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_assignments: {
        Row: {
          agent_id: string
          assigned_at: string
          campaign_id: string
          id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          campaign_id: string
          id?: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          campaign_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_settings: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          field_name: string
          id: string
          sort_order: number
          visible: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name: string
          field_name: string
          id?: string
          sort_order?: number
          visible?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          field_name?: string
          id?: string
          sort_order?: number
          visible?: boolean
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          column_mapping: Json | null
          completed_at: string | null
          created_at: string
          detection_result: Json | null
          error_log: Json | null
          failed_rows: number | null
          filename: string | null
          id: string
          imported_rows: number | null
          status: string
          total_rows: number | null
          uploaded_by: string
        }
        Insert: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string
          detection_result?: Json | null
          error_log?: Json | null
          failed_rows?: number | null
          filename?: string | null
          id?: string
          imported_rows?: number | null
          status?: string
          total_rows?: number | null
          uploaded_by: string
        }
        Update: {
          column_mapping?: Json | null
          completed_at?: string | null
          created_at?: string
          detection_result?: Json | null
          error_log?: Json | null
          failed_rows?: number | null
          filename?: string | null
          id?: string
          imported_rows?: number | null
          status?: string
          total_rows?: number | null
          uploaded_by?: string
        }
        Relationships: []
      }
      lead_assignments: {
        Row: {
          agent_id: string
          assigned_at: string
          id: string
          lead_id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address_full: string | null
          address_line1: string | null
          assigned_at: string | null
          assigned_to: string | null
          business_name: string
          call_response: string | null
          called_at: string | null
          campaign_id: string | null
          category: string | null
          created_at: string
          description: string | null
          facebook: string | null
          follow_up_date: string | null
          hours_detail: string | null
          id: string
          import_batch_id: string | null
          instagram: string | null
          lead_score: number
          lead_status: string
          maps_link: string | null
          not_connected_count: number
          open_status: string | null
          phone_number: string | null
          photo_url: string | null
          rating: number | null
          raw_data: Json | null
          reviews_count: number | null
          service_type: string | null
          skip_count: number
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address_full?: string | null
          address_line1?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          business_name: string
          call_response?: string | null
          called_at?: string | null
          campaign_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          facebook?: string | null
          follow_up_date?: string | null
          hours_detail?: string | null
          id?: string
          import_batch_id?: string | null
          instagram?: string | null
          lead_score?: number
          lead_status?: string
          maps_link?: string | null
          not_connected_count?: number
          open_status?: string | null
          phone_number?: string | null
          photo_url?: string | null
          rating?: number | null
          raw_data?: Json | null
          reviews_count?: number | null
          service_type?: string | null
          skip_count?: number
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_full?: string | null
          address_line1?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          business_name?: string
          call_response?: string | null
          called_at?: string | null
          campaign_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          facebook?: string | null
          follow_up_date?: string | null
          hours_detail?: string | null
          id?: string
          import_batch_id?: string | null
          instagram?: string | null
          lead_score?: number
          lead_status?: string
          maps_link?: string | null
          not_connected_count?: number
          open_status?: string | null
          phone_number?: string | null
          photo_url?: string | null
          rating?: number | null
          raw_data?: Json | null
          reviews_count?: number | null
          service_type?: string | null
          skip_count?: number
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_lead: {
        Args: { p_agent_id: string; p_lead_id: string }
        Returns: Json
      }
      compute_lead_score: {
        Args: { p_rating: number; p_reviews: number }
        Returns: number
      }
      dispose_lead: {
        Args: {
          p_agent_id: string
          p_call_response: string
          p_follow_up_date?: string
          p_lead_id: string
          p_not_connected_count?: number
          p_notes?: string
          p_skip_count?: number
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent"
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
    Enums: {
      app_role: ["admin", "agent"],
    },
  },
} as const
