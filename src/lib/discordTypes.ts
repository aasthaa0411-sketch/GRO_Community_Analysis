export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: string;
}

export interface DiscordMessage {
  message_id: string;
  channel_id: string;
  channel_name: string;
  guild_id: string;
  guild_name: string;
  author_id: string;
  author_name: string;
  timestamp: string;
  content: string;
  attachments: string[];
  reply_to_message_id: string | null;
  edited_timestamp: string | null;
}

export interface DiscordExportResponse {
  platform: "discord";
  exported_at: string;
  filters: {
    guild_id: string;
    channel_id: string;
    start: string;
    end: string;
    user_id: string | null;
  };
  message_count: number;
  messages: DiscordMessage[];
}

export interface ApiError {
  error: string;
  code?: string;
}
