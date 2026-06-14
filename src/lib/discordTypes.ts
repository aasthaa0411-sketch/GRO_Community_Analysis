export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  guild_id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  attachment_urls: string[];
  reply_to_id: string | null;
}

export interface DiscordExportResponse {
  guild_id: string;
  channel_id: string;
  filters: {
    start: string | null;
    end: string | null;
    user_id: string | null;
  };
  count: number;
  messages: DiscordMessage[];
}

export interface ApiError {
  error: string;
  code?: string;
}
