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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_settings: {
        Row: {
          business_knowledge: string
          created_at: string
          system_instruction: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_knowledge?: string
          created_at?: string
          system_instruction: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_knowledge?: string
          created_at?: string
          system_instruction?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_metadata: {
        Row: {
          apple_touch_icon_url: string
          description: string
          favicon_url: string
          id: string
          og_description: string
          og_image_url: string
          og_site_name: string
          og_title: string
          og_type: string
          title: string
          updated_at: string
        }
        Insert: {
          apple_touch_icon_url?: string
          description?: string
          favicon_url?: string
          id?: string
          og_description?: string
          og_image_url?: string
          og_site_name?: string
          og_title?: string
          og_type?: string
          title?: string
          updated_at?: string
        }
        Update: {
          apple_touch_icon_url?: string
          description?: string
          favicon_url?: string
          id?: string
          og_description?: string
          og_image_url?: string
          og_site_name?: string
          og_title?: string
          og_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          kind: string
          paddle_event_id: string | null
          spec_document_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          paddle_event_id?: string | null
          spec_document_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          paddle_event_id?: string | null
          spec_document_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      doc_type_instructions: {
        Row: {
          doc_type: string
          system_instruction: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          doc_type: string
          system_instruction: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          doc_type?: string
          system_instruction?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      doc_type_settings: {
        Row: {
          created_at: string
          doc_type: string
          section_order: Json
          section_titles: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          section_order?: Json
          section_titles?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          section_order?: Json
          section_titles?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      login_events: {
        Row: {
          created_at: string
          email: string | null
          event: string
          id: string
          ip: string | null
          provider: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          ip?: string | null
          provider?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          event?: string
          id?: string
          ip?: string | null
          provider?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          business_knowledge: string
          created_at: string
          description: string
          id: string
          name: string
          pinned_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_knowledge?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          pinned_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_knowledge?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          pinned_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_texts: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      spec_documents: {
        Row: {
          content: Json
          created_at: string
          doc_type: string
          group_id: string | null
          id: string
          model: string | null
          project_id: string | null
          prompt: string
          review_notes: Json
          review_score: number | null
          section_order: Json
          section_titles: Json
          title: string
          updated_at: string
          user_id: string
          user_notes: string
          user_prompt: string
          variant: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          doc_type?: string
          group_id?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          prompt?: string
          review_notes?: Json
          review_score?: number | null
          section_order?: Json
          section_titles?: Json
          title?: string
          updated_at?: string
          user_id: string
          user_notes?: string
          user_prompt?: string
          variant?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          doc_type?: string
          group_id?: string | null
          id?: string
          model?: string | null
          project_id?: string | null
          prompt?: string
          review_notes?: Json
          review_score?: number | null
          section_order?: Json
          section_titles?: Json
          title?: string
          updated_at?: string
          user_id?: string
          user_notes?: string
          user_prompt?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spec_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          char_count: number
          chunk_count: number
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          project_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          char_count?: number
          chunk_count?: number
          created_at?: string
          file_name: string
          file_size?: number
          id?: string
          mime_type: string
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          char_count?: number
          chunk_count?: number
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      consume_credit: {
        Args: { _doc_id?: string; _user_id: string }
        Returns: number
      }
      consume_credits: {
        Args: {
          _amount: number
          _description?: string
          _doc_id?: string
          _user_id: string
        }
        Returns: number
      }
      grant_credits: {
        Args: {
          _amount: number
          _description: string
          _kind: string
          _paddle_event_id: string
          _user_id: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_document_chunks: {
        Args: {
          _match_count?: number
          _project_id: string
          _query: string
          _user_id: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
