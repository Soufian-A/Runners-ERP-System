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
      client_payments: {
        Row: {
          amount_lbp: number | null
          amount_usd: number | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_refs: string[] | null
          payment_date: string
          payment_method: string | null
          period_from: string
          period_to: string
          statement_id: string
        }
        Insert: {
          amount_lbp?: number | null
          amount_usd?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_refs?: string[] | null
          payment_date?: string
          payment_method?: string | null
          period_from: string
          period_to: string
          statement_id: string
        }
        Update: {
          amount_lbp?: number | null
          amount_usd?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_refs?: string[] | null
          payment_date?: string
          payment_method?: string | null
          period_from?: string
          period_to?: string
          statement_id?: string
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
      client_statements: {
        Row: {
          client_id: string
          created_by: string | null
          id: string
          issued_date: string
          net_due_lbp: number | null
          net_due_usd: number | null
          notes: string | null
          order_refs: string[] | null
          paid_date: string | null
          payment_method: string | null
          period_from: string
          period_to: string
          statement_id: string
          status: string
          total_delivered: number | null
          total_delivery_fees_lbp: number | null
          total_delivery_fees_usd: number | null
          total_order_amount_lbp: number | null
          total_order_amount_usd: number | null
          total_orders: number | null
        }
        Insert: {
          client_id: string
          created_by?: string | null
          id?: string
          issued_date?: string
          net_due_lbp?: number | null
          net_due_usd?: number | null
          notes?: string | null
          order_refs?: string[] | null
          paid_date?: string | null
          payment_method?: string | null
          period_from: string
          period_to: string
          statement_id: string
          status?: string
          total_delivered?: number | null
          total_delivery_fees_lbp?: number | null
          total_delivery_fees_usd?: number | null
          total_order_amount_lbp?: number | null
          total_order_amount_usd?: number | null
          total_orders?: number | null
        }
        Update: {
          client_id?: string
          created_by?: string | null
          id?: string
          issued_date?: string
          net_due_lbp?: number | null
          net_due_usd?: number | null
          notes?: string | null
          order_refs?: string[] | null
          paid_date?: string | null
          payment_method?: string | null
          period_from?: string
          period_to?: string
          statement_id?: string
          status?: string
          total_delivered?: number | null
          total_delivery_fees_lbp?: number | null
          total_delivery_fees_usd?: number | null
          total_order_amount_lbp?: number | null
          total_order_amount_usd?: number | null
          total_orders?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_statements_client_id_fkey"
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
      company_settings: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          id: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string
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
      delivery_attempts: {
        Row: {
          attempt_date: string | null
          attempt_number: number
          created_at: string | null
          driver_id: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          next_attempt_date: string | null
          notes: string | null
          order_id: string
          status: string
        }
        Insert: {
          attempt_date?: string | null
          attempt_number?: number
          created_at?: string | null
          driver_id?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          next_attempt_date?: string | null
          notes?: string | null
          order_id: string
          status?: string
        }
        Update: {
          attempt_date?: string | null
          attempt_number?: number
          created_at?: string | null
          driver_id?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          next_attempt_date?: string | null
          notes?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_attempts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          base_fee_lbp: number | null
          base_fee_usd: number | null
          code: string
          created_at: string | null
          estimated_delivery_hours: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          base_fee_lbp?: number | null
          base_fee_usd?: number | null
          code: string
          created_at?: string | null
          estimated_delivery_hours?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          base_fee_lbp?: number | null
          base_fee_usd?: number | null
          code?: string
          created_at?: string | null
          estimated_delivery_hours?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      driver_manifests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          dispatched_at: string | null
          driver_id: string
          id: string
          manifest_date: string
          manifest_number: string
          notes: string | null
          status: string
          total_cod_lbp: number | null
          total_cod_usd: number | null
          total_orders: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          dispatched_at?: string | null
          driver_id: string
          id?: string
          manifest_date?: string
          manifest_number: string
          notes?: string | null
          status?: string
          total_cod_lbp?: number | null
          total_cod_usd?: number | null
          total_orders?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          dispatched_at?: string | null
          driver_id?: string
          id?: string
          manifest_date?: string
          manifest_number?: string
          notes?: string | null
          status?: string
          total_cod_lbp?: number | null
          total_cod_usd?: number | null
          total_orders?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_manifests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_statements: {
        Row: {
          created_by: string | null
          driver_id: string
          id: string
          issued_date: string
          net_due_lbp: number | null
          net_due_usd: number | null
          notes: string | null
          order_refs: string[] | null
          paid_date: string | null
          payment_method: string | null
          period_from: string
          period_to: string
          statement_id: string
          status: string
          total_collected_lbp: number | null
          total_collected_usd: number | null
          total_delivery_fees_lbp: number | null
          total_delivery_fees_usd: number | null
          total_driver_paid_refund_lbp: number | null
          total_driver_paid_refund_usd: number | null
        }
        Insert: {
          created_by?: string | null
          driver_id: string
          id?: string
          issued_date?: string
          net_due_lbp?: number | null
          net_due_usd?: number | null
          notes?: string | null
          order_refs?: string[] | null
          paid_date?: string | null
          payment_method?: string | null
          period_from: string
          period_to: string
          statement_id: string
          status?: string
          total_collected_lbp?: number | null
          total_collected_usd?: number | null
          total_delivery_fees_lbp?: number | null
          total_delivery_fees_usd?: number | null
          total_driver_paid_refund_lbp?: number | null
          total_driver_paid_refund_usd?: number | null
        }
        Update: {
          created_by?: string | null
          driver_id?: string
          id?: string
          issued_date?: string
          net_due_lbp?: number | null
          net_due_usd?: number | null
          notes?: string | null
          order_refs?: string[] | null
          paid_date?: string | null
          payment_method?: string | null
          period_from?: string
          period_to?: string
          statement_id?: string
          status?: string
          total_collected_lbp?: number | null
          total_collected_usd?: number | null
          total_delivery_fees_lbp?: number | null
          total_delivery_fees_usd?: number | null
          total_driver_paid_refund_lbp?: number | null
          total_driver_paid_refund_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_statements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
      manifest_orders: {
        Row: {
          created_at: string | null
          id: string
          manifest_id: string
          order_id: string
          pickup_or_delivery: string | null
          sequence_number: number | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          manifest_id: string
          order_id: string
          pickup_or_delivery?: string | null
          sequence_number?: number | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          manifest_id?: string
          order_id?: string
          pickup_or_delivery?: string | null
          sequence_number?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manifest_orders_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "driver_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manifest_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_events: {
        Row: {
          created_at: string | null
          event_code: string
          event_description: string
          id: string
          location: string | null
          notes: string | null
          order_id: string
          scanned_by: string | null
        }
        Insert: {
          created_at?: string | null
          event_code: string
          event_description: string
          id?: string
          location?: string | null
          notes?: string | null
          order_id: string
          scanned_by?: string | null
        }
        Update: {
          created_at?: string | null
          event_code?: string
          event_description?: string
          id?: string
          location?: string | null
          notes?: string | null
          order_id?: string
          scanned_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_transactions: {
        Row: {
          amount_usd: number
          created_at: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id: string
          note: string | null
          order_id: string | null
          party_id: string | null
          party_type: Database["public"]["Enums"]["party_type"]
          recorded_by: string | null
          tx_date: string
          tx_type: Database["public"]["Enums"]["tx_type"]
        }
        Insert: {
          amount_usd?: number
          created_at?: string
          direction: Database["public"]["Enums"]["tx_direction"]
          id?: string
          note?: string | null
          order_id?: string | null
          party_id?: string | null
          party_type: Database["public"]["Enums"]["party_type"]
          recorded_by?: string | null
          tx_date?: string
          tx_type: Database["public"]["Enums"]["tx_type"]
        }
        Update: {
          amount_usd?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["tx_direction"]
          id?: string
          note?: string | null
          order_id?: string | null
          party_id?: string | null
          party_type?: Database["public"]["Enums"]["party_type"]
          recorded_by?: string | null
          tx_date?: string
          tx_type?: Database["public"]["Enums"]["tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          amount_due_to_client_usd: number | null
          client_fee_rule: Database["public"]["Enums"]["fee_rule_type"]
          client_id: string
          client_net_usd: number | null
          client_settlement_status:
            | Database["public"]["Enums"]["client_settlement_status"]
            | null
          client_type: Database["public"]["Enums"]["client_type"]
          collected_amount_lbp: number | null
          collected_amount_usd: number | null
          company_paid_for_order: boolean | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_attempts: number | null
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
          failure_reason: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          last_attempt_date: string | null
          manifest_id: string | null
          notes: string | null
          order_amount_lbp: number | null
          order_amount_usd: number | null
          order_id: string
          order_type: Database["public"]["Enums"]["order_type"] | null
          prepaid_by_company: boolean | null
          prepaid_by_runners: boolean | null
          prepay_amount_lbp: number | null
          prepay_amount_usd: number | null
          promised_date: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          third_party_fee_usd: number | null
          third_party_id: string | null
          third_party_settlement_status:
            | Database["public"]["Enums"]["third_party_settlement_status"]
            | null
          tracking_number: string | null
          voucher_no: string | null
          zone_id: string | null
        }
        Insert: {
          address: string
          amount_due_to_client_usd?: number | null
          client_fee_rule: Database["public"]["Enums"]["fee_rule_type"]
          client_id: string
          client_net_usd?: number | null
          client_settlement_status?:
            | Database["public"]["Enums"]["client_settlement_status"]
            | null
          client_type: Database["public"]["Enums"]["client_type"]
          collected_amount_lbp?: number | null
          collected_amount_usd?: number | null
          company_paid_for_order?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_attempts?: number | null
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
          failure_reason?: string | null
          fulfillment: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          last_attempt_date?: string | null
          manifest_id?: string | null
          notes?: string | null
          order_amount_lbp?: number | null
          order_amount_usd?: number | null
          order_id: string
          order_type?: Database["public"]["Enums"]["order_type"] | null
          prepaid_by_company?: boolean | null
          prepaid_by_runners?: boolean | null
          prepay_amount_lbp?: number | null
          prepay_amount_usd?: number | null
          promised_date?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          third_party_fee_usd?: number | null
          third_party_id?: string | null
          third_party_settlement_status?:
            | Database["public"]["Enums"]["third_party_settlement_status"]
            | null
          tracking_number?: string | null
          voucher_no?: string | null
          zone_id?: string | null
        }
        Update: {
          address?: string
          amount_due_to_client_usd?: number | null
          client_fee_rule?: Database["public"]["Enums"]["fee_rule_type"]
          client_id?: string
          client_net_usd?: number | null
          client_settlement_status?:
            | Database["public"]["Enums"]["client_settlement_status"]
            | null
          client_type?: Database["public"]["Enums"]["client_type"]
          collected_amount_lbp?: number | null
          collected_amount_usd?: number | null
          company_paid_for_order?: boolean | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_attempts?: number | null
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
          failure_reason?: string | null
          fulfillment?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          last_attempt_date?: string | null
          manifest_id?: string | null
          notes?: string | null
          order_amount_lbp?: number | null
          order_amount_usd?: number | null
          order_id?: string
          order_type?: Database["public"]["Enums"]["order_type"] | null
          prepaid_by_company?: boolean | null
          prepaid_by_runners?: boolean | null
          prepay_amount_lbp?: number | null
          prepay_amount_usd?: number | null
          promised_date?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          third_party_fee_usd?: number | null
          third_party_id?: string | null
          third_party_settlement_status?:
            | Database["public"]["Enums"]["third_party_settlement_status"]
            | null
          tracking_number?: string | null
          voucher_no?: string | null
          zone_id?: string | null
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
            foreignKeyName: "orders_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "driver_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_third_party_id_fkey"
            columns: ["third_party_id"]
            isOneToOne: false
            referencedRelation: "third_parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
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
      generate_client_statement_id: { Args: never; Returns: string }
      generate_driver_statement_id: { Args: never; Returns: string }
      generate_manifest_number: { Args: never; Returns: string }
      generate_statement_id: { Args: never; Returns: string }
      generate_tracking_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_cashbox_atomic: {
        Args: {
          p_cash_in_lbp?: number
          p_cash_in_usd?: number
          p_cash_out_lbp?: number
          p_cash_out_usd?: number
          p_date: string
        }
        Returns: undefined
      }
      update_driver_wallet_atomic: {
        Args: {
          p_amount_lbp: number
          p_amount_usd: number
          p_driver_id: string
        }
        Returns: undefined
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
      client_settlement_status: "Unpaid" | "Paid"
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
      party_type: "CLIENT" | "THIRD_PARTY" | "CASHBOX"
      remit_status: "Pending" | "Collected"
      third_party_settlement_status: "Pending" | "Received"
      third_party_status: "New" | "With3P" | "Delivered" | "Paid"
      transaction_type: "Credit" | "Debit"
      tx_direction: "IN" | "OUT"
      tx_type:
        | "CLIENT_PAYOUT"
        | "THIRD_PARTY_REMITTANCE"
        | "DELIVERY_FEE_INCOME"
        | "PREPAYMENT"
        | "COLLECTION"
        | "ADJUSTMENT"
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
      client_settlement_status: ["Unpaid", "Paid"],
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
      party_type: ["CLIENT", "THIRD_PARTY", "CASHBOX"],
      remit_status: ["Pending", "Collected"],
      third_party_settlement_status: ["Pending", "Received"],
      third_party_status: ["New", "With3P", "Delivered", "Paid"],
      transaction_type: ["Credit", "Debit"],
      tx_direction: ["IN", "OUT"],
      tx_type: [
        "CLIENT_PAYOUT",
        "THIRD_PARTY_REMITTANCE",
        "DELIVERY_FEE_INCOME",
        "PREPAYMENT",
        "COLLECTION",
        "ADJUSTMENT",
      ],
    },
  },
} as const
