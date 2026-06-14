import { authHeaders, getBotUrl } from "./config";
import type {
  ApiError,
  DiscordChannel,
  DiscordExportResponse,
  DiscordGuild,
} from "./discordTypes";

export const GRO_GUILD_ID = "1453124352890503229";

function friendlyError(status: number, rawMessage: string): string {
  if (status === 401) {
    return "Unauthorized — check your Export API key in Connection settings.";
  }
  if (status === 503) {
    return "Bot is waking up (Render free tier). Wait ~30 seconds and try again.";
  }
  if (status === 403) {
    return rawMessage || "Bot lacks ReadMessageHistory on this channel.";
  }
  if (status === 404) {
    return rawMessage || "Guild or channel not found, or bot lacks access.";
  }
  if (status === 400) {
    return rawMessage || "Invalid export parameters.";
  }
  return rawMessage || `Request failed (${status})`;
}

function networkError(): Error {
  return new Error(
    "Could not reach the bot. Check the Bot URL. If you see a CORS error in the browser console, ensure the bot has CORS_ORIGINS=http://localhost:5173 on Render.",
  );
}

export function filenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null;
  const match = header.match(/filename="?([^";\n]+)"?/);
  return match?.[1] ?? null;
}

async function botFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getBotUrl()}${path}`, {
      headers: { ...authHeaders() },
    });
  } catch {
    throw networkError();
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(friendlyError(res.status, message));
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
  const data = await botFetch<{ guild_id: string; channels: DiscordChannel[] }>(
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
}

export interface ExportResult {
  data: DiscordExportResponse | Blob;
  filename?: string;
}

export async function exportMessages(
  params: ExportParams,
): Promise<ExportResult> {
  const search = new URLSearchParams({
    guild_id: params.guildId,
    channel_id: params.channelId,
    start: params.start,
    end: params.end,
    format: params.format ?? "json",
  });

  if (params.userId) search.set("user_id", params.userId);

  const url = `${getBotUrl()}/api/discord/export?${search}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { ...authHeaders() } });
  } catch {
    throw networkError();
  }

  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    throw new Error(friendlyError(res.status, message));
  }

  const filename =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    undefined;

  if (params.format === "csv") {
    return { data: await res.blob(), filename };
  }

  return {
    data: (await res.json()) as DiscordExportResponse,
    filename,
  };
}
