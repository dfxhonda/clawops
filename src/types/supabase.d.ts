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
      alert_types: {
        Row: {
          color_hex: string | null
          created_at: string | null
          icon_emoji: string | null
          is_active: boolean
          label: string
          organization_id: string
          sort_order: number
          type_code: string
          type_id: string
          updated_at: string | null
        }
        Insert: {
          color_hex?: string | null
          created_at?: string | null
          icon_emoji?: string | null
          is_active?: boolean
          label: string
          organization_id: string
          sort_order?: number
          type_code: string
          type_id?: string
          updated_at?: string | null
        }
        Update: {
          color_hex?: string | null
          created_at?: string | null
          icon_emoji?: string | null
          is_active?: boolean
          label?: string
          organization_id?: string
          sort_order?: number
          type_code?: string
          type_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          after: Json | null
          before: Json | null
          created_at: string
          device_info: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: number
          ip_address: string | null
          operation: string
          previous_hash: string
          record_id: string
          table_name: string
          this_hash: string
          user_id: string | null
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          device_info?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: number
          ip_address?: string | null
          operation: string
          previous_hash?: string
          record_id: string
          table_name: string
          this_hash: string
          user_id?: string | null
        }
        Update: {
          after?: Json | null
          before?: Json | null
          created_at?: string
          device_info?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: number
          ip_address?: string | null
          operation?: string
          previous_hash?: string
          record_id?: string
          table_name?: string
          this_hash?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auth_logs: {
        Row: {
          action: string
          created_at: string | null
          id: number
          ip_address: string | null
          staff_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: never
          ip_address?: string | null
          staff_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: never
          ip_address?: string | null
          staff_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_contracts: {
        Row: {
          area_name: string | null
          auto_renew: boolean | null
          billing_day: number | null
          billing_method: string | null
          contract_id: string
          contract_type: string | null
          created_at: string | null
          end_date: string | null
          is_active: boolean | null
          notes: string | null
          operator_id: string | null
          organization_id: string
          prize_sourcing: string | null
          prize_stock_by: string | null
          revenue_share: number | null
          start_date: string | null
          store_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          area_name?: string | null
          auto_renew?: boolean | null
          billing_day?: number | null
          billing_method?: string | null
          contract_id?: string
          contract_type?: string | null
          created_at?: string | null
          end_date?: string | null
          is_active?: boolean | null
          notes?: string | null
          operator_id?: string | null
          organization_id: string
          prize_sourcing?: string | null
          prize_stock_by?: string | null
          revenue_share?: number | null
          start_date?: string | null
          store_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          area_name?: string | null
          auto_renew?: boolean | null
          billing_day?: number | null
          billing_method?: string | null
          contract_id?: string
          contract_type?: string | null
          created_at?: string | null
          end_date?: string | null
          is_active?: boolean | null
          notes?: string | null
          operator_id?: string | null
          organization_id?: string
          prize_sourcing?: string | null
          prize_stock_by?: string | null
          revenue_share?: number | null
          start_date?: string | null
          store_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_contracts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "billing_contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "billing_contracts_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      billing_entities: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          id: string
          organization_id: string
          seal_image_path: string | null
          seal_image_url: string | null
          tel: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          created_at?: string
          id?: string
          organization_id: string
          seal_image_path?: string | null
          seal_image_url?: string | null
          tel?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          id?: string
          organization_id?: string
          seal_image_path?: string | null
          seal_image_url?: string | null
          tel?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          billing_date: string
          billing_id: string
          collected_amount: number | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          created_by: string | null
          machine_details: Json | null
          note: string | null
          organization_id: string
          payout_rate: number | null
          period_from: string
          period_to: string
          split_fc: number | null
          split_hq: number | null
          split_store: number | null
          status: string | null
          store_code: string
          total_in_diff: number | null
          total_out_diff: number | null
          total_sales: number | null
        }
        Insert: {
          billing_date: string
          billing_id?: string
          collected_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          machine_details?: Json | null
          note?: string | null
          organization_id: string
          payout_rate?: number | null
          period_from: string
          period_to: string
          split_fc?: number | null
          split_hq?: number | null
          split_store?: number | null
          status?: string | null
          store_code: string
          total_in_diff?: number | null
          total_out_diff?: number | null
          total_sales?: number | null
        }
        Update: {
          billing_date?: string
          billing_id?: string
          collected_amount?: number | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          machine_details?: Json | null
          note?: string | null
          organization_id?: string
          payout_rate?: number | null
          period_from?: string
          period_to?: string
          split_fc?: number | null
          split_hq?: number | null
          split_store?: number | null
          status?: string | null
          store_code?: string
          total_in_diff?: number | null
          total_out_diff?: number | null
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      billing_snapshots: {
        Row: {
          billing_id: string
          booth_id: string
          created_at: string | null
          in_meter: number | null
          out_meter: number | null
          prize_name: string | null
          snapshot_id: string
        }
        Insert: {
          billing_id: string
          booth_id: string
          created_at?: string | null
          in_meter?: number | null
          out_meter?: number | null
          prize_name?: string | null
          snapshot_id?: string
        }
        Update: {
          billing_id?: string
          booth_id?: string
          created_at?: string | null
          in_meter?: number | null
          out_meter?: number | null
          prize_name?: string | null
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_snapshots_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing_events"
            referencedColumns: ["billing_id"]
          },
        ]
      }
      booth_alerts: {
        Row: {
          alert_id: string
          booth_code: string
          created_at: string
          created_by: string | null
          machine_code: string
          note: string | null
          organization_id: string
          photo_url: string | null
          reading_id: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          resolved_note: string | null
          store_code: string
          type_code: string
        }
        Insert: {
          alert_id?: string
          booth_code: string
          created_at?: string
          created_by?: string | null
          machine_code: string
          note?: string | null
          organization_id: string
          photo_url?: string | null
          reading_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          store_code: string
          type_code: string
        }
        Update: {
          alert_id?: string
          booth_code?: string
          created_at?: string
          created_by?: string | null
          machine_code?: string
          note?: string | null
          organization_id?: string
          photo_url?: string | null
          reading_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          store_code?: string
          type_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "booth_alerts_type_code_fkey"
            columns: ["type_code"]
            isOneToOne: false
            referencedRelation: "alert_types"
            referencedColumns: ["type_code"]
          },
        ]
      }
      booth_prize_stocks: {
        Row: {
          booth_code: string
          counted_at: string | null
          counted_by: string | null
          created_at: string | null
          diff_quantity: number | null
          diff_reason: string | null
          notes: string | null
          prize_id: string | null
          quantity: number
          stock_id: string
          theoretical_qty: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booth_code: string
          counted_at?: string | null
          counted_by?: string | null
          created_at?: string | null
          diff_quantity?: number | null
          diff_reason?: string | null
          notes?: string | null
          prize_id?: string | null
          quantity?: number
          stock_id?: string
          theoretical_qty?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booth_code?: string
          counted_at?: string | null
          counted_by?: string | null
          created_at?: string | null
          diff_quantity?: number | null
          diff_reason?: string | null
          notes?: string | null
          prize_id?: string | null
          quantity?: number
          stock_id?: string
          theoretical_qty?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booth_prize_stocks_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "booth_prize_stocks_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      booth_setting_patterns: {
        Row: {
          avg_revenue_per_play: number | null
          created_at: string | null
          machine_model_code: string | null
          notes: string | null
          pattern_id: string
          prize_shape_class: string | null
          prize_weight_class: string | null
          recommended_c_max: number | null
          recommended_c_min: number | null
          recommended_l_max: number | null
          recommended_l_min: number | null
          recommended_r_max: number | null
          recommended_r_min: number | null
          sample_count: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          avg_revenue_per_play?: number | null
          created_at?: string | null
          machine_model_code?: string | null
          notes?: string | null
          pattern_id?: string
          prize_shape_class?: string | null
          prize_weight_class?: string | null
          recommended_c_max?: number | null
          recommended_c_min?: number | null
          recommended_l_max?: number | null
          recommended_l_min?: number | null
          recommended_r_max?: number | null
          recommended_r_min?: number | null
          sample_count?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          avg_revenue_per_play?: number | null
          created_at?: string | null
          machine_model_code?: string | null
          notes?: string | null
          pattern_id?: string
          prize_shape_class?: string | null
          prize_weight_class?: string | null
          recommended_c_max?: number | null
          recommended_c_min?: number | null
          recommended_l_max?: number | null
          recommended_l_min?: number | null
          recommended_r_max?: number | null
          recommended_r_min?: number | null
          sample_count?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booth_setting_patterns_machine_model_code_fkey"
            columns: ["machine_model_code"]
            isOneToOne: false
            referencedRelation: "machine_models"
            referencedColumns: ["model_id"]
          },
        ]
      }
      booths: {
        Row: {
          booth_code: string
          booth_label: string | null
          booth_number: number
          created_at: string | null
          current_phase: string | null
          current_prize_id: string | null
          is_active: boolean | null
          machine_code: string
          meter_in_number: number | null
          meter_in_shared: boolean | null
          meter_out_number: number | null
          notes: string | null
          out_meter_count: number | null
          payout_setting: number | null
          play_price: number | null
          setting_c: number | null
          setting_l: number | null
          setting_other: string | null
          setting_r: number | null
          store_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booth_code: string
          booth_label?: string | null
          booth_number: number
          created_at?: string | null
          current_phase?: string | null
          current_prize_id?: string | null
          is_active?: boolean | null
          machine_code: string
          meter_in_number?: number | null
          meter_in_shared?: boolean | null
          meter_out_number?: number | null
          notes?: string | null
          out_meter_count?: number | null
          payout_setting?: number | null
          play_price?: number | null
          setting_c?: number | null
          setting_l?: number | null
          setting_other?: string | null
          setting_r?: number | null
          store_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booth_code?: string
          booth_label?: string | null
          booth_number?: number
          created_at?: string | null
          current_phase?: string | null
          current_prize_id?: string | null
          is_active?: boolean | null
          machine_code?: string
          meter_in_number?: number | null
          meter_in_shared?: boolean | null
          meter_out_number?: number | null
          notes?: string | null
          out_meter_count?: number | null
          payout_setting?: number | null
          play_price?: number | null
          setting_c?: number | null
          setting_l?: number | null
          setting_other?: string | null
          setting_r?: number | null
          store_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booths_current_prize_id_fkey"
            columns: ["current_prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
          {
            foreignKeyName: "booths_machine_code_fkey"
            columns: ["machine_code"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["machine_code"]
          },
          {
            foreignKeyName: "booths_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      capsule_materials: {
        Row: {
          capsule_size: string | null
          created_at: string | null
          location_id: string
          material_id: string
          material_type: string
          min_threshold: number | null
          notes: string | null
          price_tier: number | null
          prize_id: string | null
          quantity: number
          source_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          capsule_size?: string | null
          created_at?: string | null
          location_id: string
          material_id?: string
          material_type: string
          min_threshold?: number | null
          notes?: string | null
          price_tier?: number | null
          prize_id?: string | null
          quantity?: number
          source_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          capsule_size?: string | null
          created_at?: string | null
          location_id?: string
          material_id?: string
          material_type?: string
          min_threshold?: number | null
          notes?: string | null
          price_tier?: number | null
          prize_id?: string | null
          quantity?: number
          source_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capsule_materials_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "capsule_materials_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      capsule_orders: {
        Row: {
          bag_count: number
          completed_at: string | null
          created_at: string | null
          from_location_id: string | null
          is_recurring: boolean | null
          notes: string | null
          order_id: string
          ordered_by: string | null
          picked_up_at: string | null
          price_tier: number
          produced_by: string | null
          recurring_rule: string | null
          shipped_at: string | null
          status: string | null
          to_location_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bag_count: number
          completed_at?: string | null
          created_at?: string | null
          from_location_id?: string | null
          is_recurring?: boolean | null
          notes?: string | null
          order_id?: string
          ordered_by?: string | null
          picked_up_at?: string | null
          price_tier: number
          produced_by?: string | null
          recurring_rule?: string | null
          shipped_at?: string | null
          status?: string | null
          to_location_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bag_count?: number
          completed_at?: string | null
          created_at?: string | null
          from_location_id?: string | null
          is_recurring?: boolean | null
          notes?: string | null
          order_id?: string
          ordered_by?: string | null
          picked_up_at?: string | null
          price_tier?: number
          produced_by?: string | null
          recurring_rule?: string | null
          shipped_at?: string | null
          status?: string | null
          to_location_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capsule_orders_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "capsule_orders_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
        ]
      }
      capsule_stocks: {
        Row: {
          bag_count: number
          created_at: string | null
          location_id: string
          min_threshold: number | null
          notes: string | null
          price_tier: number
          stock_id: string
          total_pieces: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bag_count?: number
          created_at?: string | null
          location_id: string
          min_threshold?: number | null
          notes?: string | null
          price_tier: number
          stock_id?: string
          total_pieces?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bag_count?: number
          created_at?: string | null
          location_id?: string
          min_threshold?: number | null
          notes?: string | null
          price_tier?: number
          stock_id?: string
          total_pieces?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capsule_stocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
        ]
      }
      cash_collection_booths: {
        Row: {
          advance_payment: number
          bill_1000: number
          bill_10000: number
          bill_5000: number
          booth_code: string
          coin_100: number
          coin_50: number
          coin_500: number
          collection_id: string
          created_at: string | null
          id: string
          in_meter_current: number | null
          in_meter_prev: number | null
          machine_code: string
          notes: string | null
          out_meter_current: number | null
          out_meter_prev: number | null
          receipt_photo_path: string | null
          receipt_photo_url: string | null
          store_code: string
          total: number | null
        }
        Insert: {
          advance_payment?: number
          bill_1000?: number
          bill_10000?: number
          bill_5000?: number
          booth_code: string
          coin_100?: number
          coin_50?: number
          coin_500?: number
          collection_id: string
          created_at?: string | null
          id: string
          in_meter_current?: number | null
          in_meter_prev?: number | null
          machine_code: string
          notes?: string | null
          out_meter_current?: number | null
          out_meter_prev?: number | null
          receipt_photo_path?: string | null
          receipt_photo_url?: string | null
          store_code: string
          total?: number | null
        }
        Update: {
          advance_payment?: number
          bill_1000?: number
          bill_10000?: number
          bill_5000?: number
          booth_code?: string
          coin_100?: number
          coin_50?: number
          coin_500?: number
          collection_id?: string
          created_at?: string | null
          id?: string
          in_meter_current?: number | null
          in_meter_prev?: number | null
          machine_code?: string
          notes?: string | null
          out_meter_current?: number | null
          out_meter_prev?: number | null
          receipt_photo_path?: string | null
          receipt_photo_url?: string | null
          store_code?: string
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_collection_booths_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "cash_collections"
            referencedColumns: ["collection_id"]
          },
        ]
      }
      cash_collections: {
        Row: {
          collected_at: string
          collected_by: string | null
          collection_id: string
          created_at: string | null
          customer_signature_path: string | null
          customer_signature_url: string | null
          customer_signed_at: string | null
          notes: string | null
          organization_id: string
          prev_collection_date: string | null
          signed_pdf_path: string | null
          signed_pdf_url: string | null
          staff_signature_path: string | null
          staff_signature_url: string | null
          status: string
          store_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          collected_at: string
          collected_by?: string | null
          collection_id: string
          created_at?: string | null
          customer_signature_path?: string | null
          customer_signature_url?: string | null
          customer_signed_at?: string | null
          notes?: string | null
          organization_id: string
          prev_collection_date?: string | null
          signed_pdf_path?: string | null
          signed_pdf_url?: string | null
          staff_signature_path?: string | null
          staff_signature_url?: string | null
          status?: string
          store_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          collected_at?: string
          collected_by?: string | null
          collection_id?: string
          created_at?: string | null
          customer_signature_path?: string | null
          customer_signature_url?: string | null
          customer_signed_at?: string | null
          notes?: string | null
          organization_id?: string
          prev_collection_date?: string | null
          signed_pdf_path?: string | null
          signed_pdf_url?: string | null
          staff_signature_path?: string | null
          staff_signature_url?: string | null
          status?: string
          store_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_collections_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "cash_collections_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "cash_collections_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      coin_changer_events: {
        Row: {
          adjustment_type: string | null
          created_at: string
          created_by: string | null
          event_date: string
          event_id: string
          event_type: string
          exchanged_in: Json | null
          exchanged_out: Json | null
          in_meter_readings: Json | null
          machine_code: string
          meter_reset_at: string | null
          note: string | null
          organization_id: string
          out_meter_readings: Json | null
          restock_source: string | null
          restocked: Json | null
          store_code: string
          updated_at: string | null
          updated_by: string | null
          withdrawn_cash: Json | null
        }
        Insert: {
          adjustment_type?: string | null
          created_at?: string
          created_by?: string | null
          event_date: string
          event_id?: string
          event_type: string
          exchanged_in?: Json | null
          exchanged_out?: Json | null
          in_meter_readings?: Json | null
          machine_code: string
          meter_reset_at?: string | null
          note?: string | null
          organization_id: string
          out_meter_readings?: Json | null
          restock_source?: string | null
          restocked?: Json | null
          store_code: string
          updated_at?: string | null
          updated_by?: string | null
          withdrawn_cash?: Json | null
        }
        Update: {
          adjustment_type?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_id?: string
          event_type?: string
          exchanged_in?: Json | null
          exchanged_out?: Json | null
          in_meter_readings?: Json | null
          machine_code?: string
          meter_reset_at?: string | null
          note?: string | null
          organization_id?: string
          out_meter_readings?: Json | null
          restock_source?: string | null
          restocked?: Json | null
          store_code?: string
          updated_at?: string | null
          updated_by?: string | null
          withdrawn_cash?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "coin_changer_events_machine_code_fkey"
            columns: ["machine_code"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["machine_code"]
          },
          {
            foreignKeyName: "coin_changer_events_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      daily_booth_stats: {
        Row: {
          booth_code: string
          created_at: string | null
          meter_in_end: number | null
          meter_in_start: number | null
          meter_out_end: number | null
          meter_out_start: number | null
          notes: string | null
          payout_rate: number | null
          payout_setting_at: number | null
          phase_at: string | null
          play_50wma: number | null
          play_7dma: number | null
          play_count: number | null
          prize_cost: number | null
          prize_id: string | null
          prize_out_count: number | null
          recorded_by: string | null
          revenue: number | null
          stat_date: string
          stat_id: string
          store_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booth_code: string
          created_at?: string | null
          meter_in_end?: number | null
          meter_in_start?: number | null
          meter_out_end?: number | null
          meter_out_start?: number | null
          notes?: string | null
          payout_rate?: number | null
          payout_setting_at?: number | null
          phase_at?: string | null
          play_50wma?: number | null
          play_7dma?: number | null
          play_count?: number | null
          prize_cost?: number | null
          prize_id?: string | null
          prize_out_count?: number | null
          recorded_by?: string | null
          revenue?: number | null
          stat_date: string
          stat_id?: string
          store_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booth_code?: string
          created_at?: string | null
          meter_in_end?: number | null
          meter_in_start?: number | null
          meter_out_end?: number | null
          meter_out_start?: number | null
          notes?: string | null
          payout_rate?: number | null
          payout_setting_at?: number | null
          phase_at?: string | null
          play_50wma?: number | null
          play_7dma?: number | null
          play_count?: number | null
          prize_cost?: number | null
          prize_id?: string | null
          prize_out_count?: number | null
          recorded_by?: string | null
          revenue?: number | null
          stat_date?: string
          stat_id?: string
          store_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_booth_stats_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "daily_booth_stats_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
          {
            foreignKeyName: "daily_booth_stats_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      daily_machine_stats: {
        Row: {
          created_at: string | null
          machine_code: string
          notes: string | null
          play_50wma: number | null
          play_7dma: number | null
          recorded_by: string | null
          stat_date: string
          stat_id: string
          store_code: string
          total_play_count: number | null
          total_prize_cost: number | null
          total_revenue: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          machine_code: string
          notes?: string | null
          play_50wma?: number | null
          play_7dma?: number | null
          recorded_by?: string | null
          stat_date: string
          stat_id?: string
          store_code: string
          total_play_count?: number | null
          total_prize_cost?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          machine_code?: string
          notes?: string | null
          play_50wma?: number | null
          play_7dma?: number | null
          recorded_by?: string | null
          stat_date?: string
          stat_id?: string
          store_code?: string
          total_play_count?: number | null
          total_prize_cost?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_machine_stats_machine_code_fkey"
            columns: ["machine_code"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["machine_code"]
          },
          {
            foreignKeyName: "daily_machine_stats_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      dev_assets: {
        Row: {
          byte_size: number | null
          created_at: string
          file_type: string | null
          id: string
          label: string
          mime_type: string | null
          organization_id: string | null
          original_filename: string | null
          purpose: string | null
          sha256: string | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          file_type?: string | null
          id?: string
          label: string
          mime_type?: string | null
          organization_id?: string | null
          original_filename?: string | null
          purpose?: string | null
          sha256?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          file_type?: string | null
          id?: string
          label?: string
          mime_type?: string | null
          organization_id?: string | null
          original_filename?: string | null
          purpose?: string | null
          sha256?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "dev_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "dev_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      device_login_history: {
        Row: {
          created_at: string
          device_id: string
          last_login_at: string
          login_count: number
          organization_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          last_login_at?: string
          login_count?: number
          organization_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          last_login_at?: string
          login_count?: number
          organization_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_login_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "device_login_history_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "device_login_history_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      glossary_terms: {
        Row: {
          bubble_text: string
          category: string
          created_at: string
          detail_text: string | null
          display_color: string | null
          is_active: boolean
          label_full: string | null
          label_short: string
          organization_id: string
          related_terms: string[] | null
          screen_locations: string[] | null
          sort_order: number | null
          term_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bubble_text: string
          category: string
          created_at?: string
          detail_text?: string | null
          display_color?: string | null
          is_active?: boolean
          label_full?: string | null
          label_short: string
          organization_id: string
          related_terms?: string[] | null
          screen_locations?: string[] | null
          sort_order?: number | null
          term_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bubble_text?: string
          category?: string
          created_at?: string
          detail_text?: string | null
          display_color?: string | null
          is_active?: boolean
          label_full?: string | null
          label_short?: string
          organization_id?: string
          related_terms?: string[] | null
          screen_locations?: string[] | null
          sort_order?: number | null
          term_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glossary_terms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      hourly_booth_stats: {
        Row: {
          booth_code: string
          created_at: string | null
          data_source: string | null
          hour_slot: number
          notes: string | null
          plays: number | null
          prizes_out: number | null
          revenue: number | null
          stat_date: string
          stat_id: string
          stock_remaining: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booth_code: string
          created_at?: string | null
          data_source?: string | null
          hour_slot: number
          notes?: string | null
          plays?: number | null
          prizes_out?: number | null
          revenue?: number | null
          stat_date: string
          stat_id?: string
          stock_remaining?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booth_code?: string
          created_at?: string | null
          data_source?: string | null
          hour_slot?: number
          notes?: string | null
          plays?: number | null
          prizes_out?: number | null
          revenue?: number | null
          stat_date?: string
          stat_id?: string
          stock_remaining?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hourly_booth_stats_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
        ]
      }
      inventory_migration_decisions: {
        Row: {
          created_at: string | null
          decided_at: string | null
          decided_by: string | null
          id: number
          item_index: number | null
          location_type: string | null
          machine_name: string | null
          note: string | null
          price: number | null
          prize_name_orig: string
          quantity: number | null
          selected_prize_id: string | null
          selected_prize_name: string | null
          sheet_name: string
          status: string
          store: string | null
        }
        Insert: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: number
          item_index?: number | null
          location_type?: string | null
          machine_name?: string | null
          note?: string | null
          price?: number | null
          prize_name_orig: string
          quantity?: number | null
          selected_prize_id?: string | null
          selected_prize_name?: string | null
          sheet_name: string
          status?: string
          store?: string | null
        }
        Update: {
          created_at?: string | null
          decided_at?: string | null
          decided_by?: string | null
          id?: number
          item_index?: number | null
          location_type?: string | null
          machine_name?: string | null
          note?: string | null
          price?: number | null
          prize_name_orig?: string
          quantity?: number | null
          selected_prize_id?: string | null
          selected_prize_name?: string | null
          sheet_name?: string
          status?: string
          store?: string | null
        }
        Relationships: []
      }
      location_zones: {
        Row: {
          created_at: string | null
          is_active: boolean | null
          location_id: string
          organization_id: string
          sort_order: number | null
          updated_at: string | null
          updated_by: string | null
          zone_id: string
          zone_name: string
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean | null
          location_id: string
          organization_id: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
          zone_id?: string
          zone_name: string
        }
        Update: {
          created_at?: string | null
          is_active?: boolean | null
          location_id?: string
          organization_id?: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
          zone_id?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_zones_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
        ]
      }
      locations: {
        Row: {
          capacity_note: string | null
          created_at: string | null
          destination_aliases: string[] | null
          is_active: boolean | null
          is_full: boolean | null
          is_operational: boolean | null
          location_id: string
          location_name: string
          location_type: string | null
          notes: string | null
          operator_id: string | null
          organization_id: string
          parent_location_id: string | null
          store_code: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          capacity_note?: string | null
          created_at?: string | null
          destination_aliases?: string[] | null
          is_active?: boolean | null
          is_full?: boolean | null
          is_operational?: boolean | null
          location_id: string
          location_name: string
          location_type?: string | null
          notes?: string | null
          operator_id?: string | null
          organization_id: string
          parent_location_id?: string | null
          store_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          capacity_note?: string | null
          created_at?: string | null
          destination_aliases?: string[] | null
          is_active?: boolean | null
          is_full?: boolean | null
          is_operational?: boolean | null
          location_id?: string
          location_name?: string
          location_type?: string | null
          notes?: string | null
          operator_id?: string | null
          organization_id?: string
          parent_location_id?: string | null
          store_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "locations_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      locker_actions: {
        Row: {
          action_id: string
          action_type: string
          booth_code: string
          created_at: string | null
          created_by: string | null
          empty_count_snapshot: number | null
          extract_destination: string | null
          extract_reason: string | null
          notes: string | null
          prize_id: string | null
          slot_number: number | null
        }
        Insert: {
          action_id?: string
          action_type: string
          booth_code: string
          created_at?: string | null
          created_by?: string | null
          empty_count_snapshot?: number | null
          extract_destination?: string | null
          extract_reason?: string | null
          notes?: string | null
          prize_id?: string | null
          slot_number?: number | null
        }
        Update: {
          action_id?: string
          action_type?: string
          booth_code?: string
          created_at?: string | null
          created_by?: string | null
          empty_count_snapshot?: number | null
          extract_destination?: string | null
          extract_reason?: string | null
          notes?: string | null
          prize_id?: string | null
          slot_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_actions_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "locker_actions_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      locker_batches: {
        Row: {
          batch_id: string
          batch_type: string | null
          booth_code: string
          created_at: string | null
          created_by: string | null
          jackpot_kept_count: number | null
          lift_rate: number | null
          next_target_date: string | null
          notes: string | null
          photo_url: string | null
          prev_batch_id: string | null
          revenue_7d_after: number | null
          revenue_7d_before: number | null
          trigger_reason: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          batch_id?: string
          batch_type?: string | null
          booth_code: string
          created_at?: string | null
          created_by?: string | null
          jackpot_kept_count?: number | null
          lift_rate?: number | null
          next_target_date?: string | null
          notes?: string | null
          photo_url?: string | null
          prev_batch_id?: string | null
          revenue_7d_after?: number | null
          revenue_7d_before?: number | null
          trigger_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          batch_id?: string
          batch_type?: string | null
          booth_code?: string
          created_at?: string | null
          created_by?: string | null
          jackpot_kept_count?: number | null
          lift_rate?: number | null
          next_target_date?: string | null
          notes?: string | null
          photo_url?: string | null
          prev_batch_id?: string | null
          revenue_7d_after?: number | null
          revenue_7d_before?: number | null
          trigger_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_batches_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "locker_batches_prev_batch_id_fkey"
            columns: ["prev_batch_id"]
            isOneToOne: false
            referencedRelation: "locker_batches"
            referencedColumns: ["batch_id"]
          },
        ]
      }
      locker_contents: {
        Row: {
          batch_id: string | null
          booth_code: string
          content_id: string
          created_at: string | null
          empty_reason: string | null
          extracted_to: string | null
          is_empty: boolean | null
          is_jackpot: boolean | null
          last_sold_at: string | null
          notes: string | null
          placed_at: string | null
          price: number | null
          price_tier: string | null
          prize_id: string | null
          slot_number: number
          sort_order: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          batch_id?: string | null
          booth_code: string
          content_id?: string
          created_at?: string | null
          empty_reason?: string | null
          extracted_to?: string | null
          is_empty?: boolean | null
          is_jackpot?: boolean | null
          last_sold_at?: string | null
          notes?: string | null
          placed_at?: string | null
          price?: number | null
          price_tier?: string | null
          prize_id?: string | null
          slot_number: number
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          batch_id?: string | null
          booth_code?: string
          content_id?: string
          created_at?: string | null
          empty_reason?: string | null
          extracted_to?: string | null
          is_empty?: boolean | null
          is_jackpot?: boolean | null
          last_sold_at?: string | null
          notes?: string | null
          placed_at?: string | null
          price?: number | null
          price_tier?: string | null
          prize_id?: string | null
          slot_number?: number
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_contents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "locker_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "locker_contents_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "locker_contents_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      locker_restock_logs: {
        Row: {
          created_at: string | null
          locker_id: string
          log_id: string
          machine_code: string
          note: string | null
          read_time: string
          recorded_by: string | null
          restocked_slots: number
          store_code: string
        }
        Insert: {
          created_at?: string | null
          locker_id: string
          log_id?: string
          machine_code: string
          note?: string | null
          read_time?: string
          recorded_by?: string | null
          restocked_slots?: number
          store_code: string
        }
        Update: {
          created_at?: string | null
          locker_id?: string
          log_id?: string
          machine_code?: string
          note?: string | null
          read_time?: string
          recorded_by?: string | null
          restocked_slots?: number
          store_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_restock_logs_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "machine_lockers"
            referencedColumns: ["locker_id"]
          },
        ]
      }
      locker_slot_logs: {
        Row: {
          action: string
          locker_id: string
          log_id: string
          logged_at: string | null
          logged_by: string | null
          prize_name: string | null
          prize_value: number | null
          slot_id: string
        }
        Insert: {
          action: string
          locker_id: string
          log_id: string
          logged_at?: string | null
          logged_by?: string | null
          prize_name?: string | null
          prize_value?: number | null
          slot_id: string
        }
        Update: {
          action?: string
          locker_id?: string
          log_id?: string
          logged_at?: string | null
          logged_by?: string | null
          prize_name?: string | null
          prize_value?: number | null
          slot_id?: string
        }
        Relationships: []
      }
      locker_slots: {
        Row: {
          locker_id: string
          prize_name: string | null
          prize_value: number | null
          slot_id: string
          slot_number: number
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          locker_id: string
          prize_name?: string | null
          prize_value?: number | null
          slot_id?: string
          slot_number: number
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          locker_id?: string
          prize_name?: string | null
          prize_value?: number | null
          slot_id?: string
          slot_number?: number
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locker_slots_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "machine_lockers"
            referencedColumns: ["locker_id"]
          },
        ]
      }
      machine_categories: {
        Row: {
          category_id: string
          category_name: string
          created_at: string | null
          sort_order: number | null
        }
        Insert: {
          category_id: string
          category_name: string
          created_at?: string | null
          sort_order?: number | null
        }
        Update: {
          category_id?: string
          category_name?: string
          created_at?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      machine_lockers: {
        Row: {
          created_at: string | null
          is_active: boolean | null
          lock_type: string
          locker_id: string
          locker_model: string | null
          locker_number: number
          machine_code: string
          notes: string | null
          slot_count: number
          store_code: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean | null
          lock_type: string
          locker_id?: string
          locker_model?: string | null
          locker_number: number
          machine_code: string
          notes?: string | null
          slot_count: number
          store_code: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          is_active?: boolean | null
          lock_type?: string
          locker_id?: string
          locker_model?: string | null
          locker_number?: number
          machine_code?: string
          notes?: string | null
          slot_count?: number
          store_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_lockers_machine_code_fkey"
            columns: ["machine_code"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["machine_code"]
          },
          {
            foreignKeyName: "machine_lockers_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      machine_manuals: {
        Row: {
          created_at: string | null
          is_published: boolean | null
          manual_id: string
          model_id: string
          notes: string | null
          organization_id: string
          updated_at: string | null
          updated_by: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          is_published?: boolean | null
          manual_id?: string
          model_id: string
          notes?: string | null
          organization_id: string
          updated_at?: string | null
          updated_by?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          is_published?: boolean | null
          manual_id?: string
          model_id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string | null
          updated_by?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_manuals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "machine_models"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "machine_manuals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      machine_models: {
        Row: {
          booth_count: number | null
          changer_denominations: Json | null
          created_at: string | null
          depth_mm: number | null
          image_url: string | null
          in_meter_count: number
          manufacturer: string | null
          meter_count: number | null
          meter_layout: Json | null
          meter_unit_price: number | null
          model_id: string
          model_name: string
          notes: string | null
          organization_id: string
          out_meter_count: number
          power_w: number | null
          size_info: string | null
          type_id: string
          updated_at: string | null
          updated_by: string | null
          weight_kg: number | null
          width_mm: number | null
        }
        Insert: {
          booth_count?: number | null
          changer_denominations?: Json | null
          created_at?: string | null
          depth_mm?: number | null
          image_url?: string | null
          in_meter_count?: number
          manufacturer?: string | null
          meter_count?: number | null
          meter_layout?: Json | null
          meter_unit_price?: number | null
          model_id: string
          model_name: string
          notes?: string | null
          organization_id: string
          out_meter_count?: number
          power_w?: number | null
          size_info?: string | null
          type_id: string
          updated_at?: string | null
          updated_by?: string | null
          weight_kg?: number | null
          width_mm?: number | null
        }
        Update: {
          booth_count?: number | null
          changer_denominations?: Json | null
          created_at?: string | null
          depth_mm?: number | null
          image_url?: string | null
          in_meter_count?: number
          manufacturer?: string | null
          meter_count?: number | null
          meter_layout?: Json | null
          meter_unit_price?: number | null
          model_id?: string
          model_name?: string
          notes?: string | null
          organization_id?: string
          out_meter_count?: number
          power_w?: number | null
          size_info?: string | null
          type_id?: string
          updated_at?: string | null
          updated_by?: string | null
          weight_kg?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_models_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "machine_models_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["type_id"]
          },
        ]
      }
      machine_types: {
        Row: {
          category: string
          created_at: string | null
          locker_slots: number | null
          notes: string | null
          type_id: string
          type_name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          locker_slots?: number | null
          notes?: string | null
          type_id: string
          type_name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          locker_slots?: number | null
          notes?: string | null
          type_id?: string
          type_name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      machines: {
        Row: {
          acquired_at: string | null
          acquisition_cost: number | null
          billing_order: number | null
          contract_id: string | null
          created_at: string | null
          floor: string | null
          floor_area_m2: number | null
          installed_at: string | null
          is_active: boolean | null
          last_maintenance_at: string | null
          lease_end_date: string | null
          lease_monthly: number | null
          lease_months: number | null
          machine_code: string
          machine_name: string | null
          machine_number: string | null
          maintenance_status: string | null
          meter_per_play: number | null
          meter_unit_price: number
          model_id: string | null
          notes: string | null
          operator_id: string | null
          organization_id: string
          out_meter_count: number
          ownership_type: string | null
          play_price: number | null
          round_order: number | null
          store_code: string
          type_id: string | null
          updated_at: string | null
          updated_by: string | null
          zone: string | null
        }
        Insert: {
          acquired_at?: string | null
          acquisition_cost?: number | null
          billing_order?: number | null
          contract_id?: string | null
          created_at?: string | null
          floor?: string | null
          floor_area_m2?: number | null
          installed_at?: string | null
          is_active?: boolean | null
          last_maintenance_at?: string | null
          lease_end_date?: string | null
          lease_monthly?: number | null
          lease_months?: number | null
          machine_code: string
          machine_name?: string | null
          machine_number?: string | null
          maintenance_status?: string | null
          meter_per_play?: number | null
          meter_unit_price?: number
          model_id?: string | null
          notes?: string | null
          operator_id?: string | null
          organization_id: string
          out_meter_count?: number
          ownership_type?: string | null
          play_price?: number | null
          round_order?: number | null
          store_code: string
          type_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          zone?: string | null
        }
        Update: {
          acquired_at?: string | null
          acquisition_cost?: number | null
          billing_order?: number | null
          contract_id?: string | null
          created_at?: string | null
          floor?: string | null
          floor_area_m2?: number | null
          installed_at?: string | null
          is_active?: boolean | null
          last_maintenance_at?: string | null
          lease_end_date?: string | null
          lease_monthly?: number | null
          lease_months?: number | null
          machine_code?: string
          machine_name?: string | null
          machine_number?: string | null
          maintenance_status?: string | null
          meter_per_play?: number | null
          meter_unit_price?: number
          model_id?: string | null
          notes?: string | null
          operator_id?: string | null
          organization_id?: string
          out_meter_count?: number
          ownership_type?: string | null
          play_price?: number | null
          round_order?: number | null
          store_code?: string
          type_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machines_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "billing_contracts"
            referencedColumns: ["contract_id"]
          },
          {
            foreignKeyName: "machines_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "machine_models"
            referencedColumns: ["model_id"]
          },
          {
            foreignKeyName: "machines_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "machines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "machines_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
          {
            foreignKeyName: "machines_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["type_id"]
          },
        ]
      }
      manual_sections: {
        Row: {
          content: string | null
          created_at: string | null
          manual_id: string
          section_id: string
          section_type: string
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          manual_id: string
          section_id?: string
          section_type: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          manual_id?: string
          section_id?: string
          section_type?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_sections_manual_id_fkey"
            columns: ["manual_id"]
            isOneToOne: false
            referencedRelation: "machine_manuals"
            referencedColumns: ["manual_id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          booth_code: string | null
          booth_id: string
          capsule_restock: number | null
          capsule_stock: number | null
          created_at: string | null
          created_by: string | null
          cropped_photo_url: string | null
          entry_type: string | null
          flagged_at: string | null
          full_booth_code: string | null
          in_diff: number | null
          in_meter: number | null
          input_method: string | null
          is_collected: boolean
          machine_code: string | null
          note: string | null
          ocr_attempted_at: string | null
          ocr_confidence: number | null
          ocr_raw_text: string | null
          organization_id: string
          out_diff: number | null
          out_diff_1: number | null
          out_diff_2: number | null
          out_diff_3: number | null
          out_meter: number | null
          out_meter_2: number | null
          out_meter_3: number | null
          patrol_date: string | null
          payout_rate: number | null
          photo_url: string | null
          play_price: number | null
          prize_cost: number | null
          prize_cost_1: number | null
          prize_cost_2: number | null
          prize_cost_3: number | null
          prize_id: string | null
          prize_name: string | null
          prize_name_2: string | null
          prize_name_3: string | null
          prize_restock_count: number | null
          prize_stock_count: number | null
          read_time: string
          reading_id: string
          replace_cost: number | null
          replace_prize_id: string | null
          replace_prize_name: string | null
          replace_type: string | null
          restock_2: number | null
          restock_3: number | null
          revenue: number | null
          set_a: string | null
          set_c: string | null
          set_l: string | null
          set_o: string | null
          set_r: string | null
          source: string | null
          stock_2: number | null
          stock_3: number | null
          store_code: string | null
          theoretical_stock: number | null
          updated_at: string | null
          updated_by: string | null
          visit_index: number
        }
        Insert: {
          booth_code?: string | null
          booth_id: string
          capsule_restock?: number | null
          capsule_stock?: number | null
          created_at?: string | null
          created_by?: string | null
          cropped_photo_url?: string | null
          entry_type?: string | null
          flagged_at?: string | null
          full_booth_code?: string | null
          in_diff?: number | null
          in_meter?: number | null
          input_method?: string | null
          is_collected?: boolean
          machine_code?: string | null
          note?: string | null
          ocr_attempted_at?: string | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          organization_id: string
          out_diff?: number | null
          out_diff_1?: number | null
          out_diff_2?: number | null
          out_diff_3?: number | null
          out_meter?: number | null
          out_meter_2?: number | null
          out_meter_3?: number | null
          patrol_date?: string | null
          payout_rate?: number | null
          photo_url?: string | null
          play_price?: number | null
          prize_cost?: number | null
          prize_cost_1?: number | null
          prize_cost_2?: number | null
          prize_cost_3?: number | null
          prize_id?: string | null
          prize_name?: string | null
          prize_name_2?: string | null
          prize_name_3?: string | null
          prize_restock_count?: number | null
          prize_stock_count?: number | null
          read_time?: string
          reading_id?: string
          replace_cost?: number | null
          replace_prize_id?: string | null
          replace_prize_name?: string | null
          replace_type?: string | null
          restock_2?: number | null
          restock_3?: number | null
          revenue?: number | null
          set_a?: string | null
          set_c?: string | null
          set_l?: string | null
          set_o?: string | null
          set_r?: string | null
          source?: string | null
          stock_2?: number | null
          stock_3?: number | null
          store_code?: string | null
          theoretical_stock?: number | null
          updated_at?: string | null
          updated_by?: string | null
          visit_index?: number
        }
        Update: {
          booth_code?: string | null
          booth_id?: string
          capsule_restock?: number | null
          capsule_stock?: number | null
          created_at?: string | null
          created_by?: string | null
          cropped_photo_url?: string | null
          entry_type?: string | null
          flagged_at?: string | null
          full_booth_code?: string | null
          in_diff?: number | null
          in_meter?: number | null
          input_method?: string | null
          is_collected?: boolean
          machine_code?: string | null
          note?: string | null
          ocr_attempted_at?: string | null
          ocr_confidence?: number | null
          ocr_raw_text?: string | null
          organization_id?: string
          out_diff?: number | null
          out_diff_1?: number | null
          out_diff_2?: number | null
          out_diff_3?: number | null
          out_meter?: number | null
          out_meter_2?: number | null
          out_meter_3?: number | null
          patrol_date?: string | null
          payout_rate?: number | null
          photo_url?: string | null
          play_price?: number | null
          prize_cost?: number | null
          prize_cost_1?: number | null
          prize_cost_2?: number | null
          prize_cost_3?: number | null
          prize_id?: string | null
          prize_name?: string | null
          prize_name_2?: string | null
          prize_name_3?: string | null
          prize_restock_count?: number | null
          prize_stock_count?: number | null
          read_time?: string
          reading_id?: string
          replace_cost?: number | null
          replace_prize_id?: string | null
          replace_prize_name?: string | null
          replace_type?: string | null
          restock_2?: number | null
          restock_3?: number | null
          revenue?: number | null
          set_a?: string | null
          set_c?: string | null
          set_l?: string | null
          set_o?: string | null
          set_r?: string | null
          source?: string | null
          stock_2?: number | null
          stock_3?: number | null
          store_code?: string | null
          theoretical_stock?: number | null
          updated_at?: string | null
          updated_by?: string | null
          visit_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "meter_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      operation_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string | null
          detail: string | null
          id: number
          lat: number | null
          lng: number | null
          location_accuracy: number | null
          organization_id: string
          reason: string | null
          reason_code: string | null
          reason_note: string | null
          staff_id: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          detail?: string | null
          id?: never
          lat?: number | null
          lng?: number | null
          location_accuracy?: number | null
          organization_id: string
          reason?: string | null
          reason_code?: string | null
          reason_note?: string | null
          staff_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string | null
          detail?: string | null
          id?: never
          lat?: number | null
          lng?: number | null
          location_accuracy?: number | null
          organization_id?: string
          reason?: string | null
          reason_code?: string | null
          reason_note?: string | null
          staff_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      operators: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          fiscal_year_end: number | null
          is_active: boolean | null
          machine_prefix: string | null
          notes: string | null
          operator_id: string
          operator_name: string
          operator_type: string | null
          organization_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          fiscal_year_end?: number | null
          is_active?: boolean | null
          machine_prefix?: string | null
          notes?: string | null
          operator_id: string
          operator_name: string
          operator_type?: string | null
          organization_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          fiscal_year_end?: number | null
          is_active?: boolean | null
          machine_prefix?: string | null
          notes?: string | null
          operator_id?: string
          operator_name?: string
          operator_type?: string | null
          organization_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organizations: {
        Row: {
          code: string
          created_at: string | null
          is_active: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          is_active?: boolean | null
          name: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ownership_types: {
        Row: {
          created_at: string | null
          sort_order: number | null
          type_id: string
          type_name: string
        }
        Insert: {
          created_at?: string | null
          sort_order?: number | null
          type_id: string
          type_name: string
        }
        Update: {
          created_at?: string | null
          sort_order?: number | null
          type_id?: string
          type_name?: string
        }
        Relationships: []
      }
      patrol_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          sort_order: number | null
          status_id: string
          status_name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          sort_order?: number | null
          status_id: string
          status_name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          sort_order?: number | null
          status_id?: string
          status_name?: string
        }
        Relationships: []
      }
      payout_thresholds: {
        Row: {
          alert_above: number | null
          alert_below: number | null
          created_at: string | null
          machine_type_id: string | null
          max_payout_rate: number | null
          min_payout_rate: number | null
          notes: string | null
          phase: string
          play_7dma_max: number | null
          play_7dma_min: number | null
          play_price: number | null
          store_code: string | null
          threshold_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          alert_above?: number | null
          alert_below?: number | null
          created_at?: string | null
          machine_type_id?: string | null
          max_payout_rate?: number | null
          min_payout_rate?: number | null
          notes?: string | null
          phase: string
          play_7dma_max?: number | null
          play_7dma_min?: number | null
          play_price?: number | null
          store_code?: string | null
          threshold_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          alert_above?: number | null
          alert_below?: number | null
          created_at?: string | null
          machine_type_id?: string | null
          max_payout_rate?: number | null
          min_payout_rate?: number | null
          notes?: string | null
          phase?: string
          play_7dma_max?: number | null
          play_7dma_min?: number | null
          play_price?: number | null
          store_code?: string | null
          threshold_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_thresholds_machine_type_id_fkey"
            columns: ["machine_type_id"]
            isOneToOne: false
            referencedRelation: "machine_types"
            referencedColumns: ["type_id"]
          },
          {
            foreignKeyName: "payout_thresholds_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      phase_history: {
        Row: {
          booth_code: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          from_phase: string | null
          history_id: string
          machine_code: string | null
          notes: string | null
          play_7dma_at_change: number | null
          prize_id: string | null
          reason: string | null
          to_phase: string
          trigger_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booth_code?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_phase?: string | null
          history_id?: string
          machine_code?: string | null
          notes?: string | null
          play_7dma_at_change?: number | null
          prize_id?: string | null
          reason?: string | null
          to_phase: string
          trigger_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booth_code?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          from_phase?: string | null
          history_id?: string
          machine_code?: string | null
          notes?: string | null
          play_7dma_at_change?: number | null
          prize_id?: string | null
          reason?: string | null
          to_phase?: string
          trigger_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_history_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "phase_history_machine_code_fkey"
            columns: ["machine_code"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["machine_code"]
          },
          {
            foreignKeyName: "phase_history_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      prize_announcements: {
        Row: {
          case_cost: number | null
          case_quantity: number | null
          created_at: string | null
          expires_at: string | null
          favorite_memo: string | null
          favorited_at: string | null
          favorited_by: string[]
          id: number
          image_url: string | null
          notes: string | null
          order_id: string | null
          ordered_at: string | null
          prize_name: string
          release_date: string | null
          source_ref: string | null
          source_type: string
          status: string
          supplier_id: string | null
          unit_cost: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          case_cost?: number | null
          case_quantity?: number | null
          created_at?: string | null
          expires_at?: string | null
          favorite_memo?: string | null
          favorited_at?: string | null
          favorited_by?: string[]
          id?: number
          image_url?: string | null
          notes?: string | null
          order_id?: string | null
          ordered_at?: string | null
          prize_name: string
          release_date?: string | null
          source_ref?: string | null
          source_type?: string
          status?: string
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          case_cost?: number | null
          case_quantity?: number | null
          created_at?: string | null
          expires_at?: string | null
          favorite_memo?: string | null
          favorited_at?: string | null
          favorited_by?: string[]
          id?: number
          image_url?: string | null
          notes?: string | null
          order_id?: string | null
          ordered_at?: string | null
          prize_name?: string
          release_date?: string | null
          source_ref?: string | null
          source_type?: string
          status?: string
          supplier_id?: string | null
          unit_cost?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_announcements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["supplier_id"]
          },
        ]
      }
      prize_masters: {
        Row: {
          aliases: string | null
          category: string | null
          cost_updated_at: string | null
          created_at: string | null
          default_case_quantity: number | null
          expected_date: string | null
          first_order_date: string | null
          image_url: string | null
          jan_code: string | null
          latest_order_date: string | null
          notes: string | null
          order_date: string | null
          organization_id: string
          original_cost: number | null
          phase: string | null
          phase_changed_at: string | null
          phase_changed_by: string | null
          prize_id: string
          prize_name: string
          registered_at: string | null
          registered_by: string | null
          short_name: string | null
          size: string | null
          status: string | null
          supplier_id: string | null
          supplier_item_code: string | null
          supplier_name: string | null
          total_order_cases: number | null
          updated_at: string | null
          updated_by: string | null
          zero_since_date: string | null
        }
        Insert: {
          aliases?: string | null
          category?: string | null
          cost_updated_at?: string | null
          created_at?: string | null
          default_case_quantity?: number | null
          expected_date?: string | null
          first_order_date?: string | null
          image_url?: string | null
          jan_code?: string | null
          latest_order_date?: string | null
          notes?: string | null
          order_date?: string | null
          organization_id: string
          original_cost?: number | null
          phase?: string | null
          phase_changed_at?: string | null
          phase_changed_by?: string | null
          prize_id: string
          prize_name: string
          registered_at?: string | null
          registered_by?: string | null
          short_name?: string | null
          size?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_item_code?: string | null
          supplier_name?: string | null
          total_order_cases?: number | null
          updated_at?: string | null
          updated_by?: string | null
          zero_since_date?: string | null
        }
        Update: {
          aliases?: string | null
          category?: string | null
          cost_updated_at?: string | null
          created_at?: string | null
          default_case_quantity?: number | null
          expected_date?: string | null
          first_order_date?: string | null
          image_url?: string | null
          jan_code?: string | null
          latest_order_date?: string | null
          notes?: string | null
          order_date?: string | null
          organization_id?: string
          original_cost?: number | null
          phase?: string | null
          phase_changed_at?: string | null
          phase_changed_by?: string | null
          prize_id?: string
          prize_name?: string
          registered_at?: string | null
          registered_by?: string | null
          short_name?: string | null
          size?: string | null
          status?: string | null
          supplier_id?: string | null
          supplier_item_code?: string | null
          supplier_name?: string | null
          total_order_cases?: number | null
          updated_at?: string | null
          updated_by?: string | null
          zero_since_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_masters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      prize_orders: {
        Row: {
          arrived_at: string | null
          case_cost: number | null
          case_count: number | null
          case_quantity: number | null
          created_at: string | null
          destination: string | null
          expected_date: string | null
          import_meta: Json | null
          is_fully_received: boolean | null
          location_id: string | null
          notes: string | null
          order_date: string | null
          order_date_source: string | null
          order_id: string
          order_source: string | null
          ordered_by: string | null
          pieces_per_case: number | null
          prize_id: string | null
          prize_name_raw: string | null
          prize_name_short: string | null
          raw_import_id: string | null
          received_by: string | null
          received_quantity: number | null
          shipping_allocation: string | null
          shipping_allocation_method: string | null
          shipping_cost: number | null
          source_file: string | null
          status: string | null
          supplier_id: string | null
          total_tax_included: number | null
          unit_cost: number | null
          unplanned_flag: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          arrived_at?: string | null
          case_cost?: number | null
          case_count?: number | null
          case_quantity?: number | null
          created_at?: string | null
          destination?: string | null
          expected_date?: string | null
          import_meta?: Json | null
          is_fully_received?: boolean | null
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_date_source?: string | null
          order_id?: string
          order_source?: string | null
          ordered_by?: string | null
          pieces_per_case?: number | null
          prize_id?: string | null
          prize_name_raw?: string | null
          prize_name_short?: string | null
          raw_import_id?: string | null
          received_by?: string | null
          received_quantity?: number | null
          shipping_allocation?: string | null
          shipping_allocation_method?: string | null
          shipping_cost?: number | null
          source_file?: string | null
          status?: string | null
          supplier_id?: string | null
          total_tax_included?: number | null
          unit_cost?: number | null
          unplanned_flag?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          arrived_at?: string | null
          case_cost?: number | null
          case_count?: number | null
          case_quantity?: number | null
          created_at?: string | null
          destination?: string | null
          expected_date?: string | null
          import_meta?: Json | null
          is_fully_received?: boolean | null
          location_id?: string | null
          notes?: string | null
          order_date?: string | null
          order_date_source?: string | null
          order_id?: string
          order_source?: string | null
          ordered_by?: string | null
          pieces_per_case?: number | null
          prize_id?: string | null
          prize_name_raw?: string | null
          prize_name_short?: string | null
          raw_import_id?: string | null
          received_by?: string | null
          received_quantity?: number | null
          shipping_allocation?: string | null
          shipping_allocation_method?: string | null
          shipping_cost?: number | null
          source_file?: string | null
          status?: string | null
          supplier_id?: string | null
          total_tax_included?: number | null
          unit_cost?: number | null
          unplanned_flag?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["location_id"]
          },
          {
            foreignKeyName: "prize_orders_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      prize_sizes: {
        Row: {
          created_at: string | null
          is_active: boolean | null
          organization_id: string
          size_id: string
          size_name: string
          sort_order: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          is_active?: boolean | null
          organization_id: string
          size_id?: string
          size_name: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          is_active?: boolean | null
          organization_id?: string
          size_id?: string
          size_name?: string
          sort_order?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      prize_stocks: {
        Row: {
          created_at: string | null
          last_counted_at: string | null
          last_counted_by: string | null
          owner_id: string
          owner_type: string
          prize_id: string | null
          quantity: number | null
          stock_id: string
          tags: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          last_counted_at?: string | null
          last_counted_by?: string | null
          owner_id: string
          owner_type: string
          prize_id?: string | null
          quantity?: number | null
          stock_id?: string
          tags?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          last_counted_at?: string | null
          last_counted_by?: string | null
          owner_id?: string
          owner_type?: string
          prize_id?: string | null
          quantity?: number | null
          stock_id?: string
          tags?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prize_stocks_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      replacement_suggestions: {
        Row: {
          booth_code: string
          confidence_score: number | null
          created_at: string | null
          current_phase: string | null
          current_play_7dma: number | null
          current_prize_id: string | null
          decided_at: string | null
          decided_by: string | null
          notes: string | null
          reason: string | null
          rejection_reason: string | null
          result_measured_at: string | null
          result_play_7dma_after: number | null
          source_booth_code: string | null
          status: string | null
          suggested_payout: number | null
          suggested_prize_id: string | null
          suggestion_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          booth_code: string
          confidence_score?: number | null
          created_at?: string | null
          current_phase?: string | null
          current_play_7dma?: number | null
          current_prize_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          notes?: string | null
          reason?: string | null
          rejection_reason?: string | null
          result_measured_at?: string | null
          result_play_7dma_after?: number | null
          source_booth_code?: string | null
          status?: string | null
          suggested_payout?: number | null
          suggested_prize_id?: string | null
          suggestion_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          booth_code?: string
          confidence_score?: number | null
          created_at?: string | null
          current_phase?: string | null
          current_play_7dma?: number | null
          current_prize_id?: string | null
          decided_at?: string | null
          decided_by?: string | null
          notes?: string | null
          reason?: string | null
          rejection_reason?: string | null
          result_measured_at?: string | null
          result_play_7dma_after?: number | null
          source_booth_code?: string | null
          status?: string | null
          suggested_payout?: number | null
          suggested_prize_id?: string | null
          suggestion_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "replacement_suggestions_booth_code_fkey"
            columns: ["booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "replacement_suggestions_current_prize_id_fkey"
            columns: ["current_prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
          {
            foreignKeyName: "replacement_suggestions_source_booth_code_fkey"
            columns: ["source_booth_code"]
            isOneToOne: false
            referencedRelation: "booths"
            referencedColumns: ["booth_code"]
          },
          {
            foreignKeyName: "replacement_suggestions_suggested_prize_id_fkey"
            columns: ["suggested_prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      sgp_image_backfill_state: {
        Row: {
          id: number
          last_page: number
          updated_at: string
        }
        Insert: {
          id?: number
          last_page?: number
          updated_at?: string
        }
        Update: {
          id?: number
          last_page?: number
          updated_at?: string
        }
        Relationships: []
      }
      sgp_import_logs: {
        Row: {
          duration_ms: number | null
          errors: Json | null
          id: number
          records_fetched: number | null
          records_inserted: number | null
          records_skipped: number | null
          records_updated: number | null
          run_at: string | null
        }
        Insert: {
          duration_ms?: number | null
          errors?: Json | null
          id?: never
          records_fetched?: number | null
          records_inserted?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          run_at?: string | null
        }
        Update: {
          duration_ms?: number | null
          errors?: Json | null
          id?: never
          records_fetched?: number | null
          records_inserted?: number | null
          records_skipped?: number | null
          records_updated?: number | null
          run_at?: string | null
        }
        Relationships: []
      }
      sgp_zaiko_changes: {
        Row: {
          captured_at: string | null
          id: number
          item_code: string
          item_name: string | null
          supplier: string | null
          zaiko_diff: number | null
          zaiko_now: number | null
          zaiko_prev: number | null
        }
        Insert: {
          captured_at?: string | null
          id?: never
          item_code: string
          item_name?: string | null
          supplier?: string | null
          zaiko_diff?: number | null
          zaiko_now?: number | null
          zaiko_prev?: number | null
        }
        Update: {
          captured_at?: string | null
          id?: never
          item_code?: string
          item_name?: string | null
          supplier?: string | null
          zaiko_diff?: number | null
          zaiko_now?: number | null
          zaiko_prev?: number | null
        }
        Relationships: []
      }
      sgp_zaiko_snapshot: {
        Row: {
          captured_at: string | null
          data: Json
          id: number
          item_count: number | null
        }
        Insert: {
          captured_at?: string | null
          data?: Json
          id?: number
          item_count?: number | null
        }
        Update: {
          captured_at?: string | null
          data?: Json
          id?: number
          item_count?: number | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string | null
          email: string | null
          has_pin: boolean | null
          has_vehicle_stock: boolean | null
          is_active: boolean | null
          joined_at: string | null
          name: string
          name_kana: string
          notes: string | null
          operator_id: string | null
          organization_id: string
          phone: string | null
          pin: string | null
          pin_hash: string | null
          role: string | null
          staff_id: string
          store_code: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          has_pin?: boolean | null
          has_vehicle_stock?: boolean | null
          is_active?: boolean | null
          joined_at?: string | null
          name: string
          name_kana: string
          notes?: string | null
          operator_id?: string | null
          organization_id: string
          phone?: string | null
          pin?: string | null
          pin_hash?: string | null
          role?: string | null
          staff_id: string
          store_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          has_pin?: boolean | null
          has_vehicle_stock?: boolean | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string
          name_kana?: string
          notes?: string | null
          operator_id?: string | null
          organization_id?: string
          phone?: string | null
          pin?: string | null
          pin_hash?: string | null
          role?: string | null
          staff_id?: string
          store_code?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "staff_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      staff_pinned_stores: {
        Row: {
          organization_id: string | null
          pinned_at: string
          staff_id: string
          store_code: string
        }
        Insert: {
          organization_id?: string | null
          pinned_at?: string
          staff_id: string
          store_code: string
        }
        Update: {
          organization_id?: string | null
          pinned_at?: string
          staff_id?: string
          store_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pinned_stores_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_pinned_stores_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_pinned_stores_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      staff_stores: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          is_primary: boolean | null
          notes: string | null
          staff_id: string
          start_date: string | null
          store_code: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          staff_id: string
          start_date?: string | null
          store_code: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          staff_id?: string
          start_date?: string | null
          store_code?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_stores_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_stores_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "staff_stores_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      stock_movements: {
        Row: {
          adjustment_reason: string | null
          created_at: string | null
          created_by: string | null
          from_owner_id: string | null
          from_owner_type: string | null
          movement_id: string
          movement_type: string
          note: string | null
          prize_id: string | null
          quantity: number
          reason: string | null
          to_owner_id: string
          to_owner_type: string
          tracking_number: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          adjustment_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          from_owner_id?: string | null
          from_owner_type?: string | null
          movement_id?: string
          movement_type: string
          note?: string | null
          prize_id?: string | null
          quantity: number
          reason?: string | null
          to_owner_id: string
          to_owner_type: string
          tracking_number?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          adjustment_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          from_owner_id?: string | null
          from_owner_type?: string | null
          movement_id?: string
          movement_type?: string
          note?: string | null
          prize_id?: string | null
          quantity?: number
          reason?: string | null
          to_owner_id?: string
          to_owner_type?: string
          tracking_number?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
        ]
      }
      stocktake_assignees: {
        Row: {
          session_id: string
          staff_id: string
        }
        Insert: {
          session_id: string
          staff_id: string
        }
        Update: {
          session_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_assignees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "stocktake_assignees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
        ]
      }
      stocktake_items: {
        Row: {
          actual_count: number
          owner_code: string
          owner_type: string
          prize_id: string
          recorded_at: string | null
          recorded_by: string | null
          session_id: string
          theoretical_count: number | null
          variance_rate: number | null
        }
        Insert: {
          actual_count?: number
          owner_code: string
          owner_type: string
          prize_id: string
          recorded_at?: string | null
          recorded_by?: string | null
          session_id: string
          theoretical_count?: number | null
          variance_rate?: number | null
        }
        Update: {
          actual_count?: number
          owner_code?: string
          owner_type?: string
          prize_id?: string
          recorded_at?: string | null
          recorded_by?: string | null
          session_id?: string
          theoretical_count?: number | null
          variance_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_items_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prize_masters"
            referencedColumns: ["prize_id"]
          },
          {
            foreignKeyName: "stocktake_items_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "stocktake_items_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_public"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "stocktake_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stocktake_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      stocktake_sessions: {
        Row: {
          created_at: string | null
          locked_at: string | null
          month: string
          opened_by: string | null
          organization_id: string
          owner_id: string | null
          owner_type: string | null
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          locked_at?: string | null
          month: string
          opened_by?: string | null
          organization_id: string
          owner_id?: string | null
          owner_type?: string | null
          session_id?: string
          status?: string
        }
        Update: {
          created_at?: string | null
          locked_at?: string | null
          month?: string
          opened_by?: string | null
          organization_id?: string
          owner_id?: string | null
          owner_type?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      stocktake_zero_declarations: {
        Row: {
          declared_at: string | null
          session_id: string
          staff_id: string
        }
        Insert: {
          declared_at?: string | null
          session_id: string
          staff_id: string
        }
        Update: {
          declared_at?: string | null
          session_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stocktake_zero_declarations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "stocktake_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          billing_entity_id: string | null
          brand_name: string | null
          closed_at: string | null
          created_at: string | null
          gps_verified_at: string | null
          is_active: boolean | null
          is_collection_day: boolean
          lat: number | null
          lng: number | null
          locality: string | null
          locality_kana: string | null
          manager_id: string | null
          notes: string | null
          opened_at: string | null
          organization_id: string
          phone: string | null
          prize_floor_area_m2: number | null
          region: string | null
          store_code: string
          store_name: string
          store_name_official: string | null
          store_type: string | null
          total_floor_area_m2: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          billing_entity_id?: string | null
          brand_name?: string | null
          closed_at?: string | null
          created_at?: string | null
          gps_verified_at?: string | null
          is_active?: boolean | null
          is_collection_day?: boolean
          lat?: number | null
          lng?: number | null
          locality?: string | null
          locality_kana?: string | null
          manager_id?: string | null
          notes?: string | null
          opened_at?: string | null
          organization_id: string
          phone?: string | null
          prize_floor_area_m2?: number | null
          region?: string | null
          store_code: string
          store_name: string
          store_name_official?: string | null
          store_type?: string | null
          total_floor_area_m2?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          billing_entity_id?: string | null
          brand_name?: string | null
          closed_at?: string | null
          created_at?: string | null
          gps_verified_at?: string | null
          is_active?: boolean | null
          is_collection_day?: boolean
          lat?: number | null
          lng?: number | null
          locality?: string | null
          locality_kana?: string | null
          manager_id?: string | null
          notes?: string | null
          opened_at?: string | null
          organization_id?: string
          phone?: string | null
          prize_floor_area_m2?: number | null
          region?: string | null
          store_code?: string
          store_name?: string
          store_name_official?: string | null
          store_type?: string | null
          total_floor_area_m2?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_billing_entity_id_fkey"
            columns: ["billing_entity_id"]
            isOneToOne: false
            referencedRelation: "billing_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_detail: string | null
          contact_method: string | null
          created_at: string | null
          default_prize_tag: string | null
          is_active: boolean | null
          lead_time_days: number | null
          notes: string | null
          order_method: string | null
          organization_id: string
          payment_terms: string | null
          supplier_id: string
          supplier_name: string
          supplier_type: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          contact_detail?: string | null
          contact_method?: string | null
          created_at?: string | null
          default_prize_tag?: string | null
          is_active?: boolean | null
          lead_time_days?: number | null
          notes?: string | null
          order_method?: string | null
          organization_id: string
          payment_terms?: string | null
          supplier_id: string
          supplier_name: string
          supplier_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          contact_detail?: string | null
          contact_method?: string | null
          created_at?: string | null
          default_prize_tag?: string | null
          is_active?: boolean | null
          lead_time_days?: number | null
          notes?: string | null
          order_method?: string | null
          organization_id?: string
          payment_terms?: string | null
          supplier_id?: string
          supplier_name?: string
          supplier_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      transfer_types: {
        Row: {
          created_at: string | null
          sort_order: number | null
          type_id: string
          type_name: string
        }
        Insert: {
          created_at?: string | null
          sort_order?: number | null
          type_id: string
          type_name: string
        }
        Update: {
          created_at?: string | null
          sort_order?: number | null
          type_id?: string
          type_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      staff_public: {
        Row: {
          created_at: string | null
          email: string | null
          has_pin: boolean | null
          has_vehicle_stock: boolean | null
          is_active: boolean | null
          joined_at: string | null
          name: string | null
          name_kana: string | null
          notes: string | null
          operator_id: string | null
          phone: string | null
          role: string | null
          staff_id: string | null
          store_code: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          has_pin?: never
          has_vehicle_stock?: boolean | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string | null
          name_kana?: string | null
          notes?: string | null
          operator_id?: string | null
          phone?: string | null
          role?: string | null
          staff_id?: string | null
          store_code?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          has_pin?: never
          has_vehicle_stock?: boolean | null
          is_active?: boolean | null
          joined_at?: string | null
          name?: string | null
          name_kana?: string | null
          notes?: string | null
          operator_id?: string | null
          phone?: string | null
          role?: string | null
          staff_id?: string | null
          store_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["operator_id"]
          },
          {
            foreignKeyName: "staff_store_code_fkey"
            columns: ["store_code"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_code"]
          },
        ]
      }
      v_latest_readings: {
        Row: {
          booth_code: string | null
          capsule_stock: number | null
          in_diff: number | null
          in_meter: number | null
          machine_code: string | null
          note: string | null
          out_diff: number | null
          out_meter: number | null
          patrol_date: string | null
          payout_rate: number | null
          play_price: number | null
          prize_cost: number | null
          prize_id: string | null
          prize_name: string | null
          prize_restock_count: number | null
          prize_stock_count: number | null
          reading_id: string | null
          revenue: number | null
          set_a: string | null
          set_c: string | null
          set_l: string | null
          set_o: string | null
          set_r: string | null
          store_code: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      backfill_item_indices:
        | { Args: { items: Json }; Returns: number }
        | { Args: { idx_offset?: number; items: Json }; Returns: number }
      compute_daily_booth_stats: {
        Args: { target_date?: string }
        Returns: number
      }
      current_staff_id: { Args: never; Returns: string }
      current_staff_role: { Args: never; Returns: string }
      fix_new_masters: {
        Args: never
        Returns: {
          new_name: string
          old_name: string
          pid: string
          qty: number
          sz: string
          unit: number
        }[]
      }
      fn_confirm_arrival: {
        Args: {
          p_order_id: string
          p_received_quantity: number
          p_staff_id: string
          p_to_owner_id: string
          p_to_owner_type: string
        }
        Returns: undefined
      }
      fn_recompute_prize_phase: { Args: never; Returns: undefined }
      fn_reconcile_stocktake_to_ledger: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      fn_record_stock_out: {
        Args: {
          p_from_location_id: string
          p_out_type: string
          p_prize_id: string
          p_quantity: number
          p_reason: string
          p_staff_id: string
          p_target_owner_id: string
          p_target_owner_type: string
        }
        Returns: undefined
      }
      get_last_readings_by_store: {
        Args: { p_store_code: string }
        Returns: {
          full_booth_code: string
          in_meter: number
          out_meter: number
          patrol_date: string
          prize_name: string
          read_time: string
        }[]
      }
      get_latest_readings_per_booth: {
        Args: { p_booth_codes: string[] }
        Returns: {
          booth_id: string
          full_booth_code: string
          in_meter: number
          note: string
          out_meter: number
          patrol_date: string
          prize_name: string
          prize_restock_count: number
          prize_stock_count: number
          read_time: string
          reading_id: string
          set_a: string
          set_c: string
          set_l: string
          set_o: string
          set_r: string
          source: string
        }[]
      }
      take_stocktake_machine_snapshot: { Args: never; Returns: Json }
      update_booth_current_prize: {
        Args: {
          p_booth_code: string
          p_prize_id: string
          p_updated_by?: string
        }
        Returns: undefined
      }
      verify_staff_pin: {
        Args: { p_pin: string; p_staff_id: string }
        Returns: Json
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
