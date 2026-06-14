import type { DiscordMessage } from "../discordTypes";
import type { CountBucket, NumericSummary, RankedItem } from "./types";
import {
  bucketByKey,
  dateLabel,
  dayOfWeekLabel,
  formatPercent,
  hourLabel,
  numericSummary,
  topWords,
} from "./textUtils";

export interface DiscordAnalytics {
  generated_at: string;
  channel_id: string;
  date_range: { start: string | null; end: string | null };
  overview: {
    total_messages: number;
    unique_authors: number;
    first_message_at: string | null;
    last_message_at: string | null;
    span_days: number;
    messages_per_day: number;
    messages_per_author: number;
  };
  content: {
    empty_content_count: number;
    empty_content_percent: number;
    message_length: NumericSummary;
    top_words: Array<{ word: string; count: number }>;
  };
  engagement: {
    with_attachments: number;
    attachment_percent: number;
    total_attachments: number;
    replies: number;
    reply_percent: number;
    edited: number;
    edited_percent: number;
  };
  activity: {
    by_date: CountBucket[];
    by_hour: CountBucket[];
    by_day_of_week: CountBucket[];
    peak_hour: number;
    busiest_date: string | null;
    quietest_date: string | null;
  };
  authors: {
    top_by_messages: RankedItem[];
    top_by_avg_length: RankedItem[];
    single_message_authors: number;
  };
}

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function analyzeDiscordMessages(
  messages: DiscordMessage[],
  channelId: string,
  filters: { start: string | null; end: string | null },
): DiscordAnalytics {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const authorCounts = new Map<string, { name: string; count: number; lengths: number[] }>();
  let attachmentMessages = 0;
  let totalAttachments = 0;
  let replies = 0;
  let edited = 0;
  let emptyContent = 0;
  const lengths: number[] = [];
  const texts: string[] = [];

  for (const msg of messages) {
    const name = msg.author_display_name || msg.author_username;
    const entry = authorCounts.get(msg.author_id) ?? { name, count: 0, lengths: [] };
    entry.count += 1;
    entry.lengths.push(msg.content.length);
    authorCounts.set(msg.author_id, entry);

    if (msg.attachment_urls.length > 0) {
      attachmentMessages += 1;
      totalAttachments += msg.attachment_urls.length;
    }
    if (msg.reply_to_id) replies += 1;
    if (msg.edited_at) edited += 1;
    if (!msg.content.trim()) emptyContent += 1;
    lengths.push(msg.content.length);
    if (msg.content.trim()) texts.push(msg.content);
  }

  const total = messages.length;
  const uniqueAuthors = authorCounts.size;
  const first = sorted[0]?.created_at ?? null;
  const last = sorted[sorted.length - 1]?.created_at ?? null;

  let spanDays = 1;
  if (first && last) {
    spanDays = Math.max(
      1,
      (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000 + 1,
    );
  }

  const byDate = bucketByKey(messages, (m) => dateLabel(m.created_at));
  const byDateSorted = [...byDate].sort((a, b) => a.label.localeCompare(b.label));
  const busiest = byDateSorted.reduce(
    (best, b) => (b.value > (best?.value ?? 0) ? b : best),
    byDateSorted[0] ?? null,
  );
  const quietest = byDateSorted.reduce(
    (best, b) => (b.value < (best?.value ?? Infinity) ? b : best),
    byDateSorted[0] ?? null,
  );

  const hourCounts = new Map<number, number>();
  for (const msg of messages) {
    const h = hourLabel(msg.created_at);
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const byHour: CountBucket[] = Array.from({ length: 24 }, (_, h) => ({
    label: `${h.toString().padStart(2, "0")}:00`,
    value: hourCounts.get(h) ?? 0,
  }));
  const peakHour = byHour.reduce((best, b) => (b.value > best.value ? b : best), byHour[0]).label;

  const dowCounts = new Map<string, number>();
  for (const msg of messages) {
    const d = dayOfWeekLabel(msg.created_at);
    dowCounts.set(d, (dowCounts.get(d) ?? 0) + 1);
  }
  const byDayOfWeek = DAY_ORDER.map((label) => ({
    label,
    value: dowCounts.get(label) ?? 0,
  }));

  const topByMessages: RankedItem[] = [...authorCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15)
    .map(([id, data]) => ({
      label: data.name,
      sublabel: id,
      value: data.count,
      percent: total ? (data.count / total) * 100 : 0,
    }));

  const topByAvgLength: RankedItem[] = [...authorCounts.entries()]
    .filter(([, d]) => d.count >= 3)
    .map(([id, data]) => ({
      label: data.name,
      sublabel: id,
      value: Math.round(
        data.lengths.reduce((s, l) => s + l, 0) / data.lengths.length,
      ),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const singleMessageAuthors = [...authorCounts.values()].filter((d) => d.count === 1).length;

  return {
    generated_at: new Date().toISOString(),
    channel_id: channelId,
    date_range: filters,
    overview: {
      total_messages: total,
      unique_authors: uniqueAuthors,
      first_message_at: first,
      last_message_at: last,
      span_days: Math.round(spanDays),
      messages_per_day: total / spanDays,
      messages_per_author: uniqueAuthors ? total / uniqueAuthors : 0,
    },
    content: {
      empty_content_count: emptyContent,
      empty_content_percent: total ? (emptyContent / total) * 100 : 0,
      message_length: numericSummary(lengths),
      top_words: topWords(texts),
    },
    engagement: {
      with_attachments: attachmentMessages,
      attachment_percent: total ? (attachmentMessages / total) * 100 : 0,
      total_attachments: totalAttachments,
      replies,
      reply_percent: total ? (replies / total) * 100 : 0,
      edited,
      edited_percent: total ? (edited / total) * 100 : 0,
    },
    activity: {
      by_date: byDateSorted,
      by_hour: byHour,
      by_day_of_week: byDayOfWeek,
      peak_hour: parseInt(peakHour, 10),
      busiest_date: busiest?.label ?? null,
      quietest_date: quietest?.label ?? null,
    },
    authors: {
      top_by_messages: topByMessages,
      top_by_avg_length: topByAvgLength,
      single_message_authors: singleMessageAuthors,
    },
  };
}

export { formatPercent };
