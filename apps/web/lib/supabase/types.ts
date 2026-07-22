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
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          user_id: string
          role: string
          invited_by?: string | null
          last_active_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          last_active_at?: string | null
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
          id?: string
          org_id: string
          name: string
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
          created_at?: string
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
          client_comments_count: number
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
          client_comments_count?: number
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
          system_key: string | null
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          name: string
          color_token?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          system_key?: string | null
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
          system_key?: string | null
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
          last_error: Json | null
          manual_published_by: string | null
          manual_published_at: string | null
          retry_requested_at: string | null
          skipped_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          content_item_id: string
          social_account_id?: string | null
          platform: string
          status?: string
          external_post_id?: string | null
          permalink?: string | null
          published_at?: string | null
          deleted_external_at?: string | null
          caption_override?: string | null
          metadata?: Json
          last_error?: Json | null
          manual_published_by?: string | null
          manual_published_at?: string | null
          retry_requested_at?: string | null
          skipped_reason?: string | null
          created_at?: string
          updated_at?: string
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
          last_error?: Json | null
          manual_published_by?: string | null
          manual_published_at?: string | null
          retry_requested_at?: string | null
          skipped_reason?: string | null
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
          metadata?: Json
          created_at?: string
          updated_at?: string
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
          id?: string
          org_id: string
          provider: string
          connected_by?: string | null
          provider_account_id: string
          provider_account_name?: string | null
          status?: string
          scopes?: string[]
          metadata?: Json
          last_health_checked_at?: string | null
          needs_reauth_at?: string | null
          created_at?: string
          updated_at?: string
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
          metadata?: Json
          created_at?: string
          updated_at?: string
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
          avatar_url: string | null
          following_count: number | null
          feed_synced_at: string | null
          feed_sync_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          platform_connection_id: string
          platform: string
          provider_account_id: string
          username?: string | null
          display_name?: string | null
          status?: string
          followers_count?: number | null
          external_url?: string | null
          metadata?: Json
          avatar_url?: string | null
          following_count?: number | null
          feed_synced_at?: string | null
          feed_sync_error?: string | null
          created_at?: string
          updated_at?: string
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
          avatar_url?: string | null
          following_count?: number | null
          feed_synced_at?: string | null
          feed_sync_error?: string | null
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
      content_versions: {
        Row: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          version_number: number
          caption: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          content_item_id: string
          version_number: number
          caption?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          content_item_id?: string
          version_number?: number
          caption?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      approvals: {
        Row: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          content_version_id: string | null
          version_label: string | null
          decided_by: string | null
          decided_by_display_name: string | null
          decided_by_role: string
          decision: string
          message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          content_item_id: string
          content_version_id?: string | null
          version_label?: string | null
          decided_by?: string | null
          decided_by_display_name?: string | null
          decided_by_role: string
          decision: string
          message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          content_item_id?: string
          content_version_id?: string | null
          version_label?: string | null
          decided_by?: string | null
          decided_by_display_name?: string | null
          decided_by_role?: string
          decision?: string
          message?: string | null
          created_at?: string
        }
        Relationships: []
      }
      content_comments: {
        Row: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          author_user_id: string | null
          author_name: string | null
          author_role: string
          visibility: string
          body: string
          annotation_content_media_id: string | null
          annotation_x: number | null
          annotation_y: number | null
          resolved_at: string | null
          resolved_by: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          content_item_id: string
          author_user_id?: string | null
          author_name?: string | null
          author_role: string
          visibility?: string
          body: string
          annotation_content_media_id?: string | null
          annotation_x?: number | null
          annotation_y?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          content_item_id?: string
          author_user_id?: string | null
          author_name?: string | null
          author_role?: string
          visibility?: string
          body?: string
          annotation_content_media_id?: string | null
          annotation_x?: number | null
          annotation_y?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_activity: {
        Row: {
          id: string
          org_id: string
          client_id: string
          content_item_id: string
          at: string
          actor_user_id: string | null
          actor_name: string | null
          kind: string
          detail: string | null
          payload: Json
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          content_item_id: string
          at?: string
          actor_user_id?: string | null
          actor_name?: string | null
          kind: string
          detail?: string | null
          payload?: Json
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          content_item_id?: string
          at?: string
          actor_user_id?: string | null
          actor_name?: string | null
          kind?: string
          detail?: string | null
          payload?: Json
          created_at?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          id: string
          org_id: string
          client_id: string
          message: string | null
          sent_at: string
          sent_by: string | null
          reminder_count: number
          last_reminded_at: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          message?: string | null
          sent_at?: string
          sent_by?: string | null
          reminder_count?: number
          last_reminded_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          message?: string | null
          sent_at?: string
          sent_by?: string | null
          reminder_count?: number
          last_reminded_at?: string | null
          closed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_request_items: {
        Row: {
          org_id: string
          client_id: string
          review_request_id: string
          content_item_id: string
          created_at: string
        }
        Insert: {
          org_id: string
          client_id: string
          review_request_id: string
          content_item_id: string
          created_at?: string
        }
        Update: {
          org_id?: string
          client_id?: string
          review_request_id?: string
          content_item_id?: string
          created_at?: string
        }
        Relationships: []
      }
      review_request_recipients: {
        Row: {
          org_id: string
          client_id: string
          review_request_id: string
          recipient_user_id: string
          notified_at: string | null
          opened_at: string | null
          created_at: string
        }
        Insert: {
          org_id: string
          client_id: string
          review_request_id: string
          recipient_user_id: string
          notified_at?: string | null
          opened_at?: string | null
          created_at?: string
        }
        Update: {
          org_id?: string
          client_id?: string
          review_request_id?: string
          recipient_user_id?: string
          notified_at?: string | null
          opened_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      client_invitations: {
        Row: {
          id: string
          org_id: string
          client_id: string
          email: string
          role: string
          token_hash: string
          status: string
          expires_at: string
          accepted_at: string | null
          accepted_user_id: string | null
          revoked_at: string | null
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          email: string
          role?: string
          token_hash: string
          status?: string
          expires_at: string
          accepted_at?: string | null
          accepted_user_id?: string | null
          revoked_at?: string | null
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          email?: string
          role?: string
          token_hash?: string
          status?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_user_id?: string | null
          revoked_at?: string | null
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      imported_posts: {
        Row: {
          id: string
          org_id: string
          client_id: string
          social_account_id: string
          external_post_id: string
          permalink: string | null
          media_product_type: string
          thumb_path: string | null
          thumb_url: string | null
          is_pinned: boolean
          published_at: string
          deleted_on_platform_at: string | null
          imported_at: string
          raw: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          social_account_id: string
          external_post_id: string
          permalink?: string | null
          media_product_type?: string
          thumb_path?: string | null
          thumb_url?: string | null
          is_pinned?: boolean
          published_at: string
          deleted_on_platform_at?: string | null
          imported_at?: string
          raw?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          social_account_id?: string
          external_post_id?: string
          permalink?: string | null
          media_product_type?: string
          thumb_path?: string | null
          thumb_url?: string | null
          is_pinned?: boolean
          published_at?: string
          deleted_on_platform_at?: string | null
          imported_at?: string
          raw?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_metrics: {
        Row: {
          id: string
          org_id: string
          client_id: string
          social_account_id: string
          platform: string
          content_target_id: string | null
          imported_post_id: string | null
          external_post_id: string | null
          likes: number
          comments_count: number
          saves: number
          reach: number | null
          engagement_total: number
          raw: Json
          measured_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          social_account_id: string
          platform: string
          content_target_id?: string | null
          imported_post_id?: string | null
          external_post_id?: string | null
          likes?: number
          comments_count?: number
          saves?: number
          reach?: number | null
          raw?: Json
          measured_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          social_account_id?: string
          platform?: string
          content_target_id?: string | null
          imported_post_id?: string | null
          external_post_id?: string | null
          likes?: number
          comments_count?: number
          saves?: number
          reach?: number | null
          raw?: Json
          measured_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_account_quota_usage: {
        Row: {
          social_account_id: string
          quota_kind: string
          org_id: string
          client_id: string
          platform: string
          used: number
          quota_limit: number | null
          window_seconds: number
          window_resets_at: string | null
          source: string
          raw: Json
          fetched_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          social_account_id: string
          quota_kind: string
          org_id: string
          client_id: string
          platform: string
          used?: number
          quota_limit?: number | null
          window_seconds?: number
          window_resets_at?: string | null
          source?: string
          raw?: Json
          fetched_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          social_account_id?: string
          quota_kind?: string
          org_id?: string
          client_id?: string
          platform?: string
          used?: number
          quota_limit?: number | null
          window_seconds?: number
          window_resets_at?: string | null
          source?: string
          raw?: Json
          fetched_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_accounts: {
        Row: {
          id: string
          org_id: string
          user_id: string
          provider: string
          provider_account_id: string
          email: string
          label: string | null
          status: string
          scopes: string[]
          needs_reauth_at: string | null
          last_synced_at: string | null
          last_sync_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          provider: string
          provider_account_id: string
          email: string
          label?: string | null
          status?: string
          scopes?: string[]
          needs_reauth_at?: string | null
          last_synced_at?: string | null
          last_sync_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          provider?: string
          provider_account_id?: string
          email?: string
          label?: string | null
          status?: string
          scopes?: string[]
          needs_reauth_at?: string | null
          last_synced_at?: string | null
          last_sync_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_calendars: {
        Row: {
          id: string
          org_id: string
          user_id: string
          calendar_account_id: string
          external_calendar_id: string
          name: string
          color_slot: number | null
          is_enabled: boolean
          is_primary: boolean
          time_zone: string | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          calendar_account_id: string
          external_calendar_id: string
          name: string
          color_slot?: number | null
          is_enabled?: boolean
          is_primary?: boolean
          time_zone?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          calendar_account_id?: string
          external_calendar_id?: string
          name?: string
          color_slot?: number | null
          is_enabled?: boolean
          is_primary?: boolean
          time_zone?: string | null
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string
          org_id: string
          user_id: string
          calendar_id: string
          external_id: string
          series_master_id: string | null
          title: string | null
          location: string | null
          all_day: boolean
          starts_at: string | null
          ends_at: string | null
          start_date: string | null
          end_date: string | null
          last_sync_run_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          calendar_id: string
          external_id: string
          series_master_id?: string | null
          title?: string | null
          location?: string | null
          all_day?: boolean
          starts_at?: string | null
          ends_at?: string | null
          start_date?: string | null
          end_date?: string | null
          last_sync_run_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          calendar_id?: string
          external_id?: string
          series_master_id?: string | null
          title?: string | null
          location?: string | null
          all_day?: boolean
          starts_at?: string | null
          ends_at?: string | null
          start_date?: string | null
          end_date?: string | null
          last_sync_run_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_account_secrets: {
        Row: {
          calendar_account_id: string
          org_id: string
          user_id: string
          vault_access_token_secret_id: string | null
          vault_refresh_token_secret_id: string | null
          token_expires_at: string | null
          refresh_token_expires_at: string | null
          last_refresh_at: string | null
          refresh_failure_count: number
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          calendar_account_id: string
          org_id: string
          user_id: string
          vault_access_token_secret_id?: string | null
          vault_refresh_token_secret_id?: string | null
          token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          last_refresh_at?: string | null
          refresh_failure_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          calendar_account_id?: string
          org_id?: string
          user_id?: string
          vault_access_token_secret_id?: string | null
          vault_refresh_token_secret_id?: string | null
          token_expires_at?: string | null
          refresh_token_expires_at?: string | null
          last_refresh_at?: string | null
          refresh_failure_count?: number
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_shares: {
        Row: {
          id: string
          org_id: string
          client_id: string
          token_hash: string
          payload: Json
          expires_at: string | null
          revoked_at: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          client_id: string
          token_hash: string
          payload: Json
          expires_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          client_id?: string
          token_hash?: string
          payload?: Json
          expires_at?: string | null
          revoked_at?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      unified_agenda: {
        Row: {
          kind: string
          source_id: string
          org_id: string
          owner_user_id: string | null
          client_id: string | null
          calendar_id: string | null
          title: string | null
          all_day: boolean
          starts_at: string | null
          ends_at: string | null
          start_date: string | null
          end_date: string | null
        }
        Relationships: []
      }
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
      // Migration 016 — transitions (Phase 6).
      mark_target_published_manually: {
        Args: {
          _target: string
          _external_post_id?: string | null
          _permalink?: string | null
        }
        Returns: string
      }
      request_target_retry: {
        Args: { _target: string }
        Returns: string
      }
      submit_review_decision: {
        Args: { _content_item: string; _decision: string; _message?: string | null }
        Returns: undefined
      }
      touch_client_member_seen: {
        Args: { _client: string }
        Returns: undefined
      }
      // Migration 018 — partage public de rapport (snapshot).
      get_report_share: {
        Args: { _token_hash: string }
        Returns: Json
      }
      emit_notification: {
        Args: {
          _recipient: string
          _org: string
          _client: string | null
          _type: string
          _title: string
          _href: string
          _audience: string
          _body?: string | null
          _channels?: string[]
          _payload?: Json
        }
        Returns: string
      }
      // Migration 019 — helpers Vault (service_role only, jamais côté client).
      store_integration_secret: {
        Args: { _secret: string; _description?: string }
        Returns: string
      }
      update_integration_secret: {
        Args: { _secret_id: string; _secret: string }
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
