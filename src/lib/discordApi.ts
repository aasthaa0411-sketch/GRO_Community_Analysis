import { authHeaders, getBotUrl } from "./config";
import type {
  ApiError,
  DiscordChannel,
  DiscordExportResponse,
  DiscordGuild,
} from "./discordTypes";

async function botFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getBotUrl()}${path}`, {
    headers: {
      ...authHeaders(),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export async function fetchGuilds(): Promise<DiscordGuild[]> {
  const data = await botFetch<{ guilds: DiscordGuild[] }>(
    "/api/discord/guilds",
  );
  return data.guilds;
}

export async function fetchChannels(guildId: string): Promise<DiscordChannel[]> {
  const data = await botFetch<{ channels: DiscordChannel[] }>(
    `/api/discord/guilds/${guildId}/channels`,
  );
  return data.channels;
}

export interface ExportParams {
  guildId: string;
  channelId: string;
  start: string;
  end: string;
  userId?: string;
  format?: "json" | "csv";
  limit?: number;
}

export async function exportMessages(
  params: ExportParams,
): Promise<DiscordExportResponse | Blob> {
  const search = new URLSearchParams({
    guild_id: params.guildId,
    channel_id: params.channelId,
    start: params.start,
    end: params.end,
    format: params.format ?? "json",
  });

  if (params.userId) search.set("user_id", params.userId);
  if (params.limit) search.set("limit", String(params.limit));

  const url = `${getBotUrl()}/api/discord/export?${search}`;
  const res = await fetch(url, { headers: { ...authHeaders() } });

  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      // CSV error bodies may not be JSON
    }
    throw new Error(message);
  }

  if (params.format === "csv") {
    return res.blob();
  }

  return res.json() as Promise<DiscordExportResponse>;
}
