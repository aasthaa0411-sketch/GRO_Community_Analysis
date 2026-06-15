import { authHeaders, getBotUrl } from "./config";
import { messagesToCsv } from "./exportUtils";
import type {
  ApiError,
  DiscordChannel,
  DiscordExportResponse,
  DiscordGuild,
  DiscordMessage,
} from "./discordTypes";

export const GRO_GUILD_ID = "1453124352890503229";

/** Discord snowflake IDs are numeric strings, typically 17–20 digits. */
export function isDiscordUserId(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

export function normalizeUserFilter(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function isUsernameFilter(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !isDiscordUserId(trimmed);
}

export function messageMatchesUserFilter(
  message: DiscordMessage,
  filter: string,
): boolean {
  const trimmed = filter.trim();
  if (!trimmed) return true;
  if (isDiscordUserId(trimmed)) {
    return message.author_id === trimmed;
  }
  const needle = normalizeUserFilter(trimmed);
  return (
    message.author_username.toLowerCase() === needle ||
    message.author_display_name.toLowerCase() === needle
  );
}

function applyUserFilter(
  payload: DiscordExportResponse,
  filter: string,
): DiscordExportResponse {
  const messages = payload.messages.filter((message) =>
    messageMatchesUserFilter(message, filter),
  );
  return {
    ...payload,
    filters: { ...payload.filters, user_id: filter.trim() },
    count: messages.length,
    messages,
  };
}

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
  const origin =
    typeof window !== "undefined" ? window.location.origin : "your app origin";
  return new Error(
    `Could not reach the bot. Check the Bot URL and Export API key. If you see a CORS error in the browser console, add this origin to CORS_ORIGINS on Render: ${origin}`,
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
  const trimmedUser = params.userId?.trim();
  const useClientFilter = trimmedUser ? isUsernameFilter(trimmedUser) : false;
  const serverUserId = trimmedUser && !useClientFilter ? trimmedUser : undefined;
  const requestFormat = useClientFilter ? "json" : (params.format ?? "json");

  const search = new URLSearchParams({
    guild_id: params.guildId,
    channel_id: params.channelId,
    start: params.start,
    end: params.end,
    format: requestFormat,
  });

  if (serverUserId) search.set("user_id", serverUserId);

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

  if (params.format === "csv" && !useClientFilter) {
    return { data: await res.blob(), filename };
  }

  const payload = (await res.json()) as DiscordExportResponse;
  const filtered =
    useClientFilter && trimmedUser
      ? applyUserFilter(payload, trimmedUser)
      : payload;

  if (params.format === "csv") {
    const csv = messagesToCsv(filtered.messages);
    return {
      data: new Blob([csv], { type: "text/csv;charset=utf-8" }),
      filename,
    };
  }

  return {
    data: filtered,
    filename,
  };
}
