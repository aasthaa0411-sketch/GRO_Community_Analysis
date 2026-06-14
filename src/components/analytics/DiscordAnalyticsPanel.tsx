import type { DiscordAnalytics } from "../../lib/analytics/discordAnalytics";
import { formatNumber, formatPercent } from "../../lib/analytics/textUtils";
import { BarChart } from "./BarChart";
import { RankedList } from "./RankedList";
import { StatGrid } from "./StatGrid";

interface DiscordAnalyticsPanelProps {
  analytics: DiscordAnalytics;
}

export function DiscordAnalyticsPanel({ analytics }: DiscordAnalyticsPanelProps) {
  const { overview, content, engagement, activity, authors } = analytics;

  return (
    <div className="analytics-panel">
      <h3>Discord analytics</h3>
      <p className="meta">
        Generated {new Date(analytics.generated_at).toLocaleString()} ·{" "}
        {overview.first_message_at?.slice(0, 10) ?? "—"} to{" "}
        {overview.last_message_at?.slice(0, 10) ?? "—"}
      </p>

      <StatGrid
        stats={[
          { label: "Total messages", value: formatNumber(overview.total_messages) },
          { label: "Unique authors", value: formatNumber(overview.unique_authors) },
          { label: "Messages / day", value: formatNumber(overview.messages_per_day, 1) },
          { label: "Messages / author", value: formatNumber(overview.messages_per_author, 1) },
          { label: "Span (days)", value: formatNumber(overview.span_days) },
          { label: "Peak hour (UTC)", value: `${activity.peak_hour}:00` },
          { label: "Busiest date", value: activity.busiest_date ?? "—" },
          { label: "Reply rate", value: formatPercent(engagement.replies, overview.total_messages) },
          { label: "With attachments", value: formatPercent(engagement.with_attachments, overview.total_messages) },
          { label: "Edited messages", value: formatPercent(engagement.edited, overview.total_messages) },
          { label: "Empty content", value: formatPercent(content.empty_content_count, overview.total_messages) },
          { label: "Total attachments", value: formatNumber(engagement.total_attachments) },
        ]}
      />

      <div className="analytics-grid">
        <BarChart title="Messages by date" data={activity.by_date} />
        <BarChart title="Messages by hour (UTC)" data={activity.by_hour} maxBars={24} />
        <BarChart title="Messages by day of week" data={activity.by_day_of_week} maxBars={7} />
      </div>

      <StatGrid
        stats={[
          {
            label: "Avg message length",
            value: `${formatNumber(content.message_length.avg, 0)} chars`,
          },
          {
            label: "Median message length",
            value: `${formatNumber(content.message_length.median, 0)} chars`,
          },
          { label: "Shortest", value: `${content.message_length.min} chars` },
          { label: "Longest", value: `${content.message_length.max} chars` },
          {
            label: "One-time authors",
            value: formatNumber(authors.single_message_authors),
            hint: "Posted exactly 1 message",
          },
        ]}
      />

      <div className="analytics-grid">
        <RankedList title="Top authors by message count" items={authors.top_by_messages} />
        <RankedList
          title="Top authors by avg message length (3+ msgs)"
          items={authors.top_by_avg_length}
          valueLabel="Avg chars"
        />
        <RankedList
          title="Top words"
          items={content.top_words.map((w) => ({ label: w.word, value: w.count }))}
          valueLabel="Uses"
        />
      </div>
    </div>
  );
}
