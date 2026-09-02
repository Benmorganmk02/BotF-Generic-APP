export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string; email: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      characters: {
        Row: {
          id: string;
          character_name: string;
          owner: string;
          character_type: 'Normal' | 'GM/NPC';
          level: number;
          character_data: string;
          shared_with: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['characters']['Row']> & { owner: string };
        Update: Partial<Database['public']['Tables']['characters']['Row']>;
      };
      friend_requests: {
        Row: {
          id: string;
          sender: string;
          receiver: string | null;
          receiver_email: string | null;
          status: 'pending' | 'accepted' | 'declined';
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['friend_requests']['Row']> & { sender: string };
        Update: Partial<Database['public']['Tables']['friend_requests']['Row']>;
      };
      campaigns: {
        Row: {
          id: string;
          campaign_name: string;
          gm: string;
          members: string[];
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['campaigns']['Row']> & { campaign_name: string; gm: string };
        Update: Partial<Database['public']['Tables']['campaigns']['Row']>;
      };
      campaign_characters: {
        Row: {
          id: string;
          character_name: string;
          campaign: string;
          original_character: string | null;
          player: string;
          character_data: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['campaign_characters']['Row']> & { campaign: string; player: string };
        Update: Partial<Database['public']['Tables']['campaign_characters']['Row']>;
      };
    };
  };
};
