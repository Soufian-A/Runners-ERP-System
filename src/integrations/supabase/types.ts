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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounting_entries: {
        Row: {
          amount_lbp: number | null
          amount_usd: number | null
          category: Database["public"]["Enums"]["accounting_category"]
          id: string
          memo: string | null
          order_ref: string | null
          ts: string | null
        }
        Insert: {
          amount_lbp?: number | null
          amount_usd?: number | null
          category: Database["public"]["Enums"]["accounting_category"]
          id?: string
          memo?: string | null
          order_ref?: string | null
          ts?: string | null
        }
        Update: {
          amount_lbp?: number | null
          amount_usd?: number | null
          category?: Database["public"]["Enums"]["accounting_category"]
          id?: string
          memo?: string | null
          order_ref?: string | null
          ts?: string | null
        }
        Relationships: []
      }
      address_areas: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      cashbox_daily: {
        Row: {
          cash_in_lbp: number | null
          cash_in_usd: number | null
          cash_out_lbp: number | null
          cash_out_usd: number | null
          closing_lbp: number | null
          closing_usd: number | null
          date: string
          id: string
          notes: string | null
          opening_lbp: number | null
          opening_usd: number | null
        }
        Insert: {
          cash_in_lbp?: number | null
          cash_in_usd?: number | null
          cash_out_lbp?: number | null
          cash_out_usd?: number | null
          closing_lbp?: number | null
          closing_usd?: number | null
          date: string
          id?: string
          notes?: string | null
          opening_lbp?: number | null
          opening_usd?: number | null
        }
        Update: {
          cash_in_lbp?: number | null
          cash_in_usd?: number | null
          cash_out_lbp?: number | null
          cash_out_usd?: number | null
          closing_lbp?: number | null
          closing_usd?: number | null
          date?: string
          id?: string
          notes?: string | null
          opening_lbp?: number | null
          opening_usd?: number | null
        }
        Relationships: []
      }
      client_rules: {
        Row: {
          allow_override: boolean | null
          client_id: string
          default_fee_lbp: number | null
          default_fee_usd: number | null
          fee_rule: Database["public"]["Enums"]["fee_rule_type"]
          id: string
        }
        Insert: {
          allow_override?: boolean | null
          client_id: string
          default_fee_lbp?: number | null
          default_fee_usd?: number | null
          fee_rule?: Database["public"]["Enums"]["fee_rule_type"]
          id?: string
        }
        Update: {
          allow_override?: boolean | null
          client_id?: string
          default_fee_lbp?: number | null
          default_fee_usd?: number | null
          fee_rule?: Database["public"]["Enums"]["fee_rule_type"]
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_transactions: {
        Row: {
          amount_lbp: number | null
          amount_usd: number | null
          client_id: string
          id: string
          note: string | null
          order_ref: string | null
          ts: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount_lbp?: number | null
          amount_usd?: number | null
          client_id: string
          id?: string
          note?: string | null
          order_ref?: string | null
          ts?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount_lbp?: number | null
          amount_usd?: number | null
          client_id?: string
          id?: string
          note?: string | null
          order_ref?: string | null
          ts?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "client_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string | null
          default_currency: Database["public"]["Enums"]["currency_type"] | null
          id: string
          location_link: string | null
          name: string
          phone: string | null
          type: Database["public"]["Enums"]["client_type"]
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency_type"] | null
          id?: string
          location_link?: string | null
          name: string
          phone?: string | null
          type: Database["public"]["Enums"]["client_type"]
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string | null
          default_currency?: Database["public"]["Enums"]["currency_type"] | null
          id?: string
          location_link?: string | null
          name?: string
          phone?: string | null
          type?: Database["public"]["Enums"]["client_type"]
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string | null
          phone: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          phone: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string | null
          phone?: string
        }
        Relationships: []
      }
      daily_expenses: {
        Row: {
          amount_lbp: number | null
          amount_usd: number | null
          category_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
        }
        Insert: {
          amount_lbp?: number | null
          amount_usd?: number | null
          category_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount_lbp?: number | null
          amount_usd?: number | null
          category_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_transactions: {
        Row: {
          amount_lbp: number | null
          amount_usd: number | null
          driver_id: string
          id: string
          note: string | null
          order_ref: string | null
          ts: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount_lbp?: number | null
          amount_usd?: number | null
          driver_id: string
          id?: string
          note?: string | null
          order_ref?: string | null
          ts?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount_lbp?: number | null
          amount_usd?: number | null
          driver_id?: string
          id?: string
          note?: string | null
          order_ref?: string | null
          ts?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "driver_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          wallet_lbp: number | null
          wallet_usd: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          wallet_lbp?: number | null
          wallet_usd?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          wallet_lbp?: number | null
          wallet_usd?: number | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          category_group: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category_group: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category_group?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          amount_due_to_client_usd: number | null
          client_fee_rule: Database["public"]["Enums"]["fee_rule_type"]
          client_id: string
          client_type: Database["public"]["Enums"]["client_type"]
          collected_amount_lbp: number | null
          collected_amount_usd: number | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_fee_lbp: number | null
          delivery_fee_usd: number | null
          driver_id: string | null
          driver_paid_amount_lbp: number | null
          driver_paid_amount_usd: number | null
          driver_paid_for_client: boolean | null
          driver_paid_reason: string | null
          driver_remit_date: string | null
          driver_remit_status:
            | Database["public"]["Enums"]["remit_status"]
            | null
          entered_by: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          notes: string | null
          order_amount_lbp: number | null
          order_amount_usd: number | null
          order_id: string
          order_type: Database["public"]["Enums"]["order_type"] | null
          prepaid_by_company: boolean | null
          prepaid_by_runners: boolean | null
          prepay_amount_lbp: number | null
          prepay_amount_usd: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          third_party_id: string | null
          voucher_no: string | null
        }
        Insert: {
          address: string
          amount_due_to_client_usd?: number | null
          client_fee_rule: Database["public"]["Enums"]["fee_rule_type"]
          client_id: string
          client_type: Database["public"]["Enums"]["client_type"]
          collected_amount_lbp?: number | null
          collected_amount_usd?: number | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_fee_lbp?: number | null
          delivery_fee_usd?: number | null
          driver_id?: string | null
          driver_paid_amount_lbp?: number | null
          driver_paid_amount_usd?: number | null
          driver_paid_for_client?: boolean | null
          driver_paid_reason?: string | null
          driver_remit_date?: string | null
          driver_remit_status?:
            | Database["public"]["Enums"]["remit_status"]
            | null
          entered_by?: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          notes?: string | null
          order_amount_lbp?: number | null
          order_amount_usd?: number | null
          order_id: string
          order_type?: Database["public"]["Enums"]["order_type"] | null
          prepaid_by_company?: boolean | null
          prepaid_by_runners?: boolean | null
          prepay_amount_lbp?: number | null
          prepay_amount_usd?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          third_party_id?: string | null
          voucher_no?: string | null
        }
        Update: {
          address?: string
          amount_due_to_client_usd?: number | null
          client_fee_rule?: Database["public"]["Enums"]["fee_rule_type"]
          client_id?: string
          client_type?: Database["public"]["Enums"]["client_type"]
          collected_amount_lbp?: number | null
          collected_amount_usd?: number | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_fee_lbp?: number | null
          delivery_fee_usd?: number | null
          driver_id?: string | null
          driver_paid_amount_lbp?: number | null
          driver_paid_amount_usd?: number | null
          driver_paid_for_client?: boolean | null
          driver_paid_reason?: string | null
          driver_remit_date?: string | null
          driver_remit_status?:
            | Database["public"]["Enums"]["remit_status"]
            | null
          entered_by?: string | null
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          notes?: string | null
          order_amount_lbp?: number | null
          order_amount_usd?: number | null
          order_id?: string
          order_type?: Database["public"]["Enums"]["order_type"] | null
          prepaid_by_company?: boolean | null
          prepaid_by_runners?: boolean | null
          prepay_amount_lbp?: number | null
          prepay_amount_usd?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          third_party_id?: string | null
          voucher_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      third_parties: {
        Row: {
          active: boolean | null
          contact: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          contact?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          contact?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      third_party_transactions: {
        Row: {
          buy_cost_lbp: number | null
          buy_cost_usd: number | null
          id: string
          order_ref: string | null
          sell_fee_lbp: number | null
          sell_fee_usd: number | null
          status: Database["public"]["Enums"]["third_party_status"] | null
          third_party_id: string
          ts: string | null
        }
        Insert: {
          buy_cost_lbp?: number | null
          buy_cost_usd?: number | null
          id?: string
          order_ref?: string | null
          sell_fee_lbp?: number | null
          sell_fee_usd?: number | null
          status?: Database["public"]["Enums"]["third_party_status"] | null
          third_party_id: string
          ts?: string | null
        }
        Update: {
          buy_cost_lbp?: number | null
          buy_cost_usd?: number | null
          id?: string
          order_ref?: string | null
          sell_fee_lbp?: number | null
          sell_fee_usd?: number | null
          status?: Database["public"]["Enums"]["third_party_status"] | null
          third_party_id?: string
          ts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "third_party_transactions_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      accounting_category:
        | "DeliveryIncome"
        | "ThirdPartyCost"
        | "PrepaidFloat"
        | "OtherExpense"
        | "OtherIncome"
      app_role: "admin" | "operator" | "viewer"
      client_type: "Ecom" | "Restaurant" | "Individual"
      currency_type: "USD" | "LBP"
      fee_rule_type: "ADD_ON" | "DEDUCT" | "INCLUDED"
      fulfillment_type: "InHouse" | "ThirdParty"
      order_status:
        | "New"
        | "Assigned"
        | "PickedUp"
        | "Delivered"
        | "Returned"
        | "Cancelled"
      order_type: "ecom" | "instant" | "errand"
      remit_status: "Pending" | "Collected"
      third_party_status: "New" | "With3P" | "Delivered" | "Paid"
      transaction_type: "Credit" | "Debit"
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
      accounting_category: [
        "DeliveryIncome",
        "ThirdPartyCost",
        "PrepaidFloat",
        "OtherExpense",
        "OtherIncome",
      ],
      app_role: ["admin", "operator", "viewer"],
      client_type: ["Ecom", "Restaurant", "Individual"],
      currency_type: ["USD", "LBP"],
      fee_rule_type: ["ADD_ON", "DEDUCT", "INCLUDED"],
      fulfillment_type: ["InHouse", "ThirdParty"],
      order_status: [
        "New",
        "Assigned",
        "PickedUp",
        "Delivered",
        "Returned",
        "Cancelled",
      ],
      order_type: ["ecom", "instant", "errand"],
      remit_status: ["Pending", "Collected"],
      third_party_status: ["New", "With3P", "Delivered", "Paid"],
      transaction_type: ["Credit", "Debit"],
    },
  },
} as const
