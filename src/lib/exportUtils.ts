export type DatePreset = "today" | "7d" | "30d" | "90d" | "custom";

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(
  preset: DatePreset,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();

  if (preset === "custom") {
    const start = customStart
      ? new Date(`${customStart}T00:00:00.000Z`).toISOString()
      : startOfUtcDay(now).toISOString();
    const customEndIso = customEnd
      ? new Date(`${customEnd}T23:59:59.999Z`).toISOString()
      : end;
    return { start, end: customEndIso };
  }

  const startDate = startOfUtcDay(now);
  if (preset === "7d") startDate.setUTCDate(startDate.getUTCDate() - 7);
  if (preset === "30d") startDate.setUTCDate(startDate.getUTCDate() - 30);
  if (preset === "90d") startDate.setUTCDate(startDate.getUTCDate() - 90);

  return { start: startDate.toISOString(), end };
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const DISCORD_CSV_HEADERS = [
  "id",
  "channel_id",
  "guild_id",
  "author_id",
  "author_username",
  "author_display_name",
  "content",
  "created_at",
  "edited_at",
  "attachment_urls",
  "reply_to_id",
] as const;

export function objectsToCsv(
  headers: readonly string[],
  rows: readonly object[],
): string {
  if (rows.length === 0) {
    return `${headers.join(",")}\n`;
  }

  const csvRows = rows.map((row) =>
    headers
      .map((key) => {
        const raw = (row as Record<string, unknown>)[key];
        if (raw == null) return "";
        if (Array.isArray(raw)) return escapeCsv(raw.join("; "));
        return escapeCsv(String(raw));
      })
      .join(","),
  );

  return [headers.join(","), ...csvRows].join("\n");
}

export function messagesToCsv(messages: readonly object[]): string {
  return objectsToCsv([...DISCORD_CSV_HEADERS], messages);
}

const YOUTUBE_CSV_HEADERS = [
  "id",
  "video_id",
  "parent_id",
  "author_channel_id",
  "author_display_name",
  "text",
  "like_count",
  "published_at",
  "updated_at",
  "is_reply",
] as const;

export function youtubeCommentsToCsv(comments: readonly object[]): string {
  return objectsToCsv([...YOUTUBE_CSV_HEADERS], comments);
}

export function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  downloadBlob(blob, filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string) {
  downloadText(JSON.stringify(data, null, 2), filename, "application/json");
}
