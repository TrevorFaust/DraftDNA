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
      draft_picks: {
        Row: {
          created_at: string
          id: string
          mock_draft_id: string
          pick_number: number
          player_id: string
          round_number: number
          team_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          mock_draft_id: string
          pick_number: number
          player_id: string
          round_number: number
          team_number: number
        }
        Update: {
          created_at?: string
          id?: string
          mock_draft_id?: string
          pick_number?: number
          player_id?: string
          round_number?: number
          team_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_mock_draft_id_fkey"
            columns: ["mock_draft_id"]
            isOneToOne: false
            referencedRelation: "mock_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_picks_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          name: string
          num_teams: number
          user_id: string
          user_pick_position: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          num_teams?: number
          user_id: string
          user_pick_position?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          num_teams?: number
          user_id?: string
          user_pick_position?: number
        }
        Relationships: []
      }
      mock_drafts: {
        Row: {
          completed_at: string | null
          created_at: string
          draft_order: string
          id: string
          league_id: string | null
          name: string
          num_rounds: number
          num_teams: number
          scoring_format: string
          status: string
          user_id: string
          user_pick_position: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          draft_order?: string
          id?: string
          league_id?: string | null
          name: string
          num_rounds?: number
          num_teams?: number
          scoring_format?: string
          status?: string
          user_id: string
          user_pick_position?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          draft_order?: string
          id?: string
          league_id?: string | null
          name?: string
          num_rounds?: number
          num_teams?: number
          scoring_format?: string
          status?: string
          user_id?: string
          user_pick_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "mock_drafts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      nfl_schedule: {
        Row: {
          away_team: string
          created_at: string
          game_date: string | null
          home_team: string
          id: string
          season: number
          week: number
        }
        Insert: {
          away_team: string
          created_at?: string
          game_date?: string | null
          home_team: string
          id?: string
          season: number
          week: number
        }
        Update: {
          away_team?: string
          created_at?: string
          game_date?: string | null
          home_team?: string
          id?: string
          season?: number
          week?: number
        }
        Relationships: []
      }
      player_game_stats: {
        Row: {
          created_at: string
          fantasy_points: number | null
          fumbles: number | null
          id: string
          interceptions: number | null
          opponent: string
          passing_tds: number | null
          passing_yards: number | null
          player_id: string
          receiving_tds: number | null
          receiving_yards: number | null
          receptions: number | null
          rushing_attempts: number | null
          rushing_tds: number | null
          rushing_yards: number | null
          season: number
          targets: number | null
          week: number
        }
        Insert: {
          created_at?: string
          fantasy_points?: number | null
          fumbles?: number | null
          id?: string
          interceptions?: number | null
          opponent: string
          passing_tds?: number | null
          passing_yards?: number | null
          player_id: string
          receiving_tds?: number | null
          receiving_yards?: number | null
          receptions?: number | null
          rushing_attempts?: number | null
          rushing_tds?: number | null
          rushing_yards?: number | null
          season: number
          targets?: number | null
          week: number
        }
        Update: {
          created_at?: string
          fantasy_points?: number | null
          fumbles?: number | null
          id?: string
          interceptions?: number | null
          opponent?: string
          passing_tds?: number | null
          passing_yards?: number | null
          player_id?: string
          receiving_tds?: number | null
          receiving_yards?: number | null
          receptions?: number | null
          rushing_attempts?: number | null
          rushing_tds?: number | null
          rushing_yards?: number | null
          season?: number
          targets?: number | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_game_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          adp: number | null
          bye_week: number | null
          created_at: string
          id: string
          name: string
          position: string
          team: string | null
        }
        Insert: {
          adp?: number | null
          bye_week?: number | null
          created_at?: string
          id?: string
          name: string
          position: string
          team?: string | null
        }
        Update: {
          adp?: number | null
          bye_week?: number | null
          created_at?: string
          id?: string
          name?: string
          position?: string
          team?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_rankings: {
        Row: {
          created_at: string
          id: string
          league_id: string | null
          player_id: string
          rank: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id?: string | null
          player_id: string
          rank: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string | null
          player_id?: string
          rank?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rankings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rankings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
