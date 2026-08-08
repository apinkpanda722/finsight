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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          plan: string
          polar_customer_id: string | null
          polar_modified_at: string | null
          polar_product_id: string | null
          polar_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email: string
          id: string
          plan?: string
          polar_customer_id?: string | null
          polar_modified_at?: string | null
          polar_product_id?: string | null
          polar_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email?: string
          id?: string
          plan?: string
          polar_customer_id?: string | null
          polar_modified_at?: string | null
          polar_product_id?: string | null
          polar_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          is_anomaly_flag: boolean
          is_duplicate_flag: boolean
          row_index: number
          statement_id: string
          transaction_date: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description: string
          id?: string
          is_anomaly_flag?: boolean
          is_duplicate_flag?: boolean
          row_index: number
          statement_id: string
          transaction_date: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_anomaly_flag?: boolean
          is_duplicate_flag?: boolean
          row_index?: number
          statement_id?: string
          transaction_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_statement_id_fkey"
            columns: ["user_id", "statement_id"]
            isOneToOne: false
            referencedRelation: "uploaded_statements"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      upload_usage: {
        Row: {
          created_at: string
          id: number
          statement_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          statement_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          statement_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_usage_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "uploaded_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_statements: {
        Row: {
          account_id: string
          created_at: string
          declared_file_size_bytes: number
          error_message: string | null
          failure_code: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          parse_attempt_count: number
          parsed_transaction_count: number | null
          period_end: string | null
          period_start: string | null
          processed_at: string | null
          processing_lease_expires_at: string | null
          row_count: number | null
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          declared_file_size_bytes: number
          error_message?: string | null
          failure_code?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          parse_attempt_count?: number
          parsed_transaction_count?: number | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          processing_lease_expires_at?: string | null
          row_count?: number | null
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          declared_file_size_bytes?: number
          error_message?: string | null
          failure_code?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          parse_attempt_count?: number
          parsed_transaction_count?: number | null
          period_end?: string | null
          period_start?: string | null
          processed_at?: string | null
          processing_lease_expires_at?: string | null
          row_count?: number | null
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_statements_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_statement_upload: {
        Args: {
          p_account_id: string
          p_declared_size: number
          p_file_name: string
          p_new_account_label: string
          p_user_id: string
        }
        Returns: {
          account_id: string
          statement_id: string
          storage_path: string
        }[]
      }
      finalize_statement: {
        Args: {
          p_statement_id: string
          p_transactions: Json
          p_user_id: string
        }
        Returns: boolean
      }
      has_locked_history: { Args: never; Returns: boolean }
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
