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

export function messagesToCsv(
  messages: Array<Record<string, unknown>>,
): string {
  if (messages.length === 0) {
    return "message_id,channel_id,channel_name,guild_id,guild_name,author_id,author_name,timestamp,content,attachments,reply_to_message_id,edited_timestamp\n";
  }

  const headers = [
    "message_id",
    "channel_id",
    "channel_name",
    "guild_id",
    "guild_name",
    "author_id",
    "author_name",
    "timestamp",
    "content",
    "attachments",
    "reply_to_message_id",
    "edited_timestamp",
  ];

  const rows = messages.map((msg) =>
    headers
      .map((key) => {
        const raw = msg[key];
        if (raw == null) return "";
        if (Array.isArray(raw)) return escapeCsv(raw.join("; "));
        return escapeCsv(String(raw));
      })
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
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
