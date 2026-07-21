// Types Supabase generes depuis le schema en ligne (hgdeopkmkwyoumsfggrm).
// Regenerer apres chaque migration : voir scripts/gen-types.py.
// Ne pas editer a la main.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      client_members: {
        Row: {
          id: string
          org_id: string
          client_id: string
          user_id: string
          role: string
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          client_id: string
          user_id: string
          role: string
          invited_by?: string | null
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          org_id: string
          name: string
          handle: string | null
          brand_color: string | null
          timezone: string
          approval_mode: string
          bio: string | null
          category: string | null
          notes: string | null
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          name: string
          handle?: string | null
          brand_color?: string | null
          timezone: string
          approval_mode: string
          bio?: string | null
          category?: string | null
          notes?: string | null
          archived_at?: string | null
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          handle?: string | null
          brand_color?: string | null
          timezone?: string
          approval_mode?: string
          bio?: string | null
          category?: string | null
          notes?: string | null
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_item_labels: {
        Row: {
          org_id: string
          client_id: string
          content_item_id: string
          content_label_id: string
          created_at: string
        }
        Insert: {
          org_id: string
          client_id: string
          content_item_id: string
          content_label_id: string
          created_at: string
        }
        Update: {
          org_id?: string
          client_id?: string
          content_item_id?: string
          content_label_id?: string
          created_at?: string
        }
        Relationships: []
      }
      content_items: {
        Row: {
          id: string
          org_id: string
          client_id: string
          title: string | null
          caption: string | null
          hashtags: string[]
          format: string
          status: string
          scheduled_at: string | null
          newsletter_subject: string | null
          internal_notes: string | null
          created_by: string | null
          approval_stale: boolean
          last_error: Json | null
          deleted_at: string | null
          archived_at: string | null
          pillar_id: string | null
          first_comment: string | null
          pinned: boolean
          exclude_from_grid: boolean
          platform_options: Json
          updated_by: string | null
          cover_media_asset_id: string | null
          cover_frame_ms: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          title?: string | null
          caption?: string | null
          hashtags?: string[]
          format?: string
          status?: string
          scheduled_at?: string | null
          newsletter_subject?: string | null
          internal_notes?: string | null
          created_by?: string | null
          approval_stale?: boolean
          last_error?: Json | null
          deleted_at?: string | null
          archived_at?: string | null
          pillar_id?: string | null
          first_comment?: string | null
          pinned?: boolean
          exclude_from_grid?: boolean
          platform_options?: Json
          updated_by?: string | null
          cover_media_asset_id?: string | null
          cover_frame_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          title?: string | null
          caption?: string | null
          hashtags?: string[]
          format?: string
          status?: string
          scheduled_at?: string | null
          newsletter_subject?: string | null
          internal_notes?: string | null
          created_by?: string | null
          approval_stale?: boolean
          last_error?: Json | null
          deleted_at?: string | null
          archived_at?: string | null
          pillar_id?: string | null
          first_comment?: string | null
          pinned?: boolean
          exclude_from_grid?: boolean
          platform_options?: Json
          updated_by?: string | null
          cover_media_asset_id?: string | null
          cover_frame_ms?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_labels: {
        Row: {
          id: string
          org_id: string
          client_id: string
          name: string
          color_token: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          client_id: string
          name: string
          color_token?: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          name?: string
          color_token?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_targets: {
        Row: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          social_account_id: string | null
          platform: string
          status: string
          external_post_id: string | null
          permalink: string | null
          published_at: string | null
          deleted_external_at: string | null
          caption_override: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          social_account_id?: string | null
          platform: string
          status: string
          external_post_id?: string | null
          permalink?: string | null
          published_at?: string | null
          deleted_external_at?: string | null
          caption_override?: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          content_item_id?: string
          social_account_id?: string | null
          platform?: string
          status?: string
          external_post_id?: string | null
          permalink?: string | null
          published_at?: string | null
          deleted_external_at?: string | null
          caption_override?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          org_id: string
          client_id: string | null
          recipient_user_id: string
          type: string
          title: string
          body: string | null
          channels: string[]
          audience: string
          href: string
          payload: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          org_id: string
          client_id?: string | null
          recipient_user_id: string
          type: string
          title: string
          body?: string | null
          channels: string[]
          audience: string
          href: string
          payload: Json
          read_at?: string | null
          created_at: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string | null
          recipient_user_id?: string
          type?: string
          title?: string
          body?: string | null
          channels?: string[]
          audience?: string
          href?: string
          payload?: Json
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: string
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          user_id: string
          role: string
          invited_by?: string | null
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          created_by: string | null
          created_at: string
          updated_at: string
          plan: string
          seats: number | null
        }
        Insert: {
          id: string
          name: string
          slug: string
          created_by?: string | null
          created_at: string
          updated_at: string
          plan: string
          seats?: number | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          plan?: string
          seats?: number | null
        }
        Relationships: []
      }
      platform_connection_secrets: {
        Row: {
          platform_connection_id: string
          org_id: string
          vault_access_token_secret_id: string | null
          vault_refresh_token_secret_id: string | null
          token_expires_at: string | null
          refresh_token_expires_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          platform_connection_id: string
          org_id: string
          vault_access_token_secret_id?: string | null
          vault_refresh_token_secret_id?: string | null
          token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Update: {
          platform_connection_id?: string
          org_id?: string
          vault_access_token_secret_id?: string | null
          vault_refresh_token_secret_id?: string | null
          token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_connections: {
        Row: {
          id: string
          org_id: string
          provider: string
          connected_by: string | null
          provider_account_id: string
          provider_account_name: string | null
          status: string
          scopes: string[]
          metadata: Json
          last_health_checked_at: string | null
          needs_reauth_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          provider: string
          connected_by?: string | null
          provider_account_id: string
          provider_account_name?: string | null
          status: string
          scopes: string[]
          metadata: Json
          last_health_checked_at?: string | null
          needs_reauth_at?: string | null
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          provider?: string
          connected_by?: string | null
          provider_account_id?: string
          provider_account_name?: string | null
          status?: string
          scopes?: string[]
          metadata?: Json
          last_health_checked_at?: string | null
          needs_reauth_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          initials: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          initials?: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          initials?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          org_id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          device_name: string | null
          last_seen_at: string | null
          revoked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          device_name?: string | null
          last_seen_at?: string | null
          revoked_at?: string | null
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          device_name?: string | null
          last_seen_at?: string | null
          revoked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_account_secrets: {
        Row: {
          social_account_id: string
          org_id: string
          client_id: string
          vault_access_token_secret_id: string | null
          vault_refresh_token_secret_id: string | null
          token_expires_at: string | null
          refresh_token_expires_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          social_account_id: string
          org_id: string
          client_id: string
          vault_access_token_secret_id?: string | null
          vault_refresh_token_secret_id?: string | null
          token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Update: {
          social_account_id?: string
          org_id?: string
          client_id?: string
          vault_access_token_secret_id?: string | null
          vault_refresh_token_secret_id?: string | null
          token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_accounts: {
        Row: {
          id: string
          org_id: string
          client_id: string
          platform_connection_id: string
          platform: string
          provider_account_id: string
          username: string | null
          display_name: string | null
          status: string
          followers_count: number | null
          external_url: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          client_id: string
          platform_connection_id: string
          platform: string
          provider_account_id: string
          username?: string | null
          display_name?: string | null
          status: string
          followers_count?: number | null
          external_url?: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          platform_connection_id?: string
          platform?: string
          provider_account_id?: string
          username?: string | null
          display_name?: string | null
          status?: string
          followers_count?: number | null
          external_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          id: string
          org_id: string
          client_id: string
          name: string
          color_token: string
          target_share: number
          sort_order: number
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          name: string
          color_token?: string
          target_share?: number
          sort_order?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          name?: string
          color_token?: string
          target_share?: number
          sort_order?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_slots: {
        Row: {
          id: string
          org_id: string
          client_id: string
          weekday: number
          time_of_day: string
          platforms: string[]
          pillar_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          weekday: number
          time_of_day: string
          platforms: string[]
          pillar_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          weekday?: number
          time_of_day?: string
          platforms?: string[]
          pillar_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hashtag_groups: {
        Row: {
          id: string
          org_id: string
          client_id: string
          name: string
          tags: string[]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          name: string
          tags: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          name?: string
          tags?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_kits: {
        Row: {
          client_id: string
          org_id: string
          palette: string[]
          tone: string | null
          do_list: string[]
          dont_list: string[]
          banned_words: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          org_id: string
          palette?: string[]
          tone?: string | null
          do_list?: string[]
          dont_list?: string[]
          banned_words?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          org_id?: string
          palette?: string[]
          tone?: string | null
          do_list?: string[]
          dont_list?: string[]
          banned_words?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_events: {
        Row: {
          id: string
          org_id: string
          client_id: string
          event_date: string
          title: string
          kind: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          event_date: string
          title: string
          kind?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          event_date?: string
          title?: string
          kind?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          id: string
          org_id: string
          client_id: string
          owner_user_id: string
          name: string
          search: string | null
          statuses: string[]
          platforms: string[]
          formats: string[]
          pillar_ids: string[]
          label_ids: string[]
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          owner_user_id: string
          name: string
          search?: string | null
          statuses?: string[]
          platforms?: string[]
          formats?: string[]
          pillar_ids?: string[]
          label_ids?: string[]
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          owner_user_id?: string
          name?: string
          search?: string | null
          statuses?: string[]
          platforms?: string[]
          formats?: string[]
          pillar_ids?: string[]
          label_ids?: string[]
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_settings: {
        Row: {
          client_id: string
          org_id: string
          review_reminder_days: number
          cadence_gap_days: number
          cadence_max_per_day: number
          cadence_alerts: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          org_id: string
          review_reminder_days?: number
          cadence_gap_days?: number
          cadence_max_per_day?: number
          cadence_alerts?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          org_id?: string
          review_reminder_days?: number
          cadence_gap_days?: number
          cadence_max_per_day?: number
          cadence_alerts?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          id: string
          org_id: string
          client_id: string
          type: string
          storage_path: string | null
          thumb_path: string | null
          mime_type: string | null
          byte_size: number | null
          width: number | null
          height: number | null
          duration_ms: number | null
          file_name: string | null
          alt_text: string | null
          source: string
          uploaded_by: string | null
          original_deleted_at: string | null
          expires_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          type: string
          storage_path?: string | null
          thumb_path?: string | null
          mime_type?: string | null
          byte_size?: number | null
          width?: number | null
          height?: number | null
          duration_ms?: number | null
          file_name?: string | null
          alt_text?: string | null
          source?: string
          uploaded_by?: string | null
          original_deleted_at?: string | null
          expires_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          type?: string
          storage_path?: string | null
          thumb_path?: string | null
          mime_type?: string | null
          byte_size?: number | null
          width?: number | null
          height?: number | null
          duration_ms?: number | null
          file_name?: string | null
          alt_text?: string | null
          source?: string
          uploaded_by?: string | null
          original_deleted_at?: string | null
          expires_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_media: {
        Row: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          media_asset_id: string
          position: number
          alt_text_override: string | null
          crop_preset: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          content_item_id: string
          media_asset_id: string
          position: number
          alt_text_override?: string | null
          crop_preset?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          content_item_id?: string
          media_asset_id?: string
          position?: number
          alt_text_override?: string | null
          crop_preset?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mark_notification_read: {
        Args: { _notification: string }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: Record<string, never>
        Returns: number
      }
      create_organization: {
        Args: { _name: string; _slug: string }
        Returns: Database["public"]["Tables"]["organizations"]["Row"]
      }
      reorder_content_media: {
        Args: { _content_item: string; _ordered_media_ids: string[] }
        Returns: undefined
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
