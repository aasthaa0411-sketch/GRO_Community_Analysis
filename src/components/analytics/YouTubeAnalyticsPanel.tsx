import type { YouTubeChannelAnalytics } from "../../lib/analytics/youtubeAnalytics";
import type { YouTubeCommentAnalytics } from "../../lib/analytics/youtubeAnalytics";
import { formatNumber, formatPercent } from "../../lib/analytics/textUtils";
import { BarChart } from "./BarChart";
import { RankedList } from "./RankedList";
import { StatGrid } from "./StatGrid";
import { UnavailableMetrics } from "./UnavailableMetrics";

interface YouTubeAnalyticsPanelProps {
  commentAnalytics: YouTubeCommentAnalytics | null;
  channelAnalytics: YouTubeChannelAnalytics | null;
}

export function YouTubeAnalyticsPanel({
  commentAnalytics,
  channelAnalytics,
}: YouTubeAnalyticsPanelProps) {
  return (
    <div className="analytics-panel">
      <h3>YouTube analytics</h3>

      {channelAnalytics && (
        <>
          <h4 className="analytics-subtitle">Channel overview</h4>
          {channelAnalytics.channel && (
            <StatGrid
              stats={[
                {
                  label: "Channel",
                  value: channelAnalytics.channel.title,
                },
                {
                  label: "Subscribers",
                  value: channelAnalytics.channel.hidden_subscriber_count
                    ? "Hidden"
                    : formatNumber(channelAnalytics.channel.subscriber_count),
                },
                {
                  label: "Lifetime views",
                  value: formatNumber(channelAnalytics.channel.total_views),
                },
                {
                  label: "Total videos (channel)",
                  value: formatNumber(channelAnalytics.channel.video_count),
                },
              ]}
            />
          )}

          <p className="meta">
            Analyzing {channelAnalytics.videos_analyzed} loaded videos
          </p>

          <StatGrid
            stats={[
              { label: "Total views", value: formatNumber(channelAnalytics.totals.views) },
              { label: "Total likes", value: formatNumber(channelAnalytics.totals.likes) },
              { label: "Total comments", value: formatNumber(channelAnalytics.totals.comments) },
              { label: "Avg views / video", value: formatNumber(channelAnalytics.totals.avg_views, 0) },
              { label: "Avg likes / video", value: formatNumber(channelAnalytics.totals.avg_likes, 1) },
              { label: "Avg comments / video", value: formatNumber(channelAnalytics.totals.avg_comments, 1) },
              {
                label: "Engagement rate",
                value: `${channelAnalytics.totals.engagement_rate_percent.toFixed(2)}%`,
                hint: "(likes + comments) / views per video",
              },
              {
                label: "Like / view",
                value: `${channelAnalytics.totals.like_to_view_percent.toFixed(2)}%`,
              },
              {
                label: "Comment / view",
                value: `${channelAnalytics.totals.comment_to_view_percent.toFixed(3)}%`,
              },
            ]}
          />

          <div className="analytics-grid">
            <RankedList
              title="Top videos by views"
              items={channelAnalytics.top_by_views}
              valueLabel="Views"
            />
            <RankedList
              title="Top videos by likes"
              items={channelAnalytics.top_by_likes}
              valueLabel="Likes"
            />
            <RankedList
              title="Top videos by comments"
              items={channelAnalytics.top_by_comments}
              valueLabel="Comments"
            />
            <RankedList
              title="Top videos by engagement rate"
              items={channelAnalytics.top_by_engagement}
              valueLabel="Engagement %"
            />
            <BarChart
              title="Videos published by month"
              data={channelAnalytics.publish_by_month}
            />
          </div>

          <UnavailableMetrics
            title="Requires Google OAuth (not yet available)"
            metrics={channelAnalytics.unavailable}
          />
        </>
      )}

      {commentAnalytics && (
        <>
          <h4 className="analytics-subtitle">
            Comment analytics — {commentAnalytics.video_title}
          </h4>
          <StatGrid
            stats={[
              { label: "Total comments", value: formatNumber(commentAnalytics.overview.total_comments) },
              { label: "Top-level", value: formatNumber(commentAnalytics.overview.top_level) },
              { label: "Replies", value: formatNumber(commentAnalytics.overview.replies) },
              {
                label: "Reply rate",
                value: formatPercent(
                  commentAnalytics.overview.replies,
                  commentAnalytics.overview.total_comments,
                ),
              },
              { label: "Unique commenters", value: formatNumber(commentAnalytics.overview.unique_commenters) },
              { label: "Verified channels", value: formatNumber(commentAnalytics.overview.verified_channels) },
              { label: "Comments / day", value: formatNumber(commentAnalytics.overview.comments_per_day, 1) },
              { label: "Total likes", value: formatNumber(commentAnalytics.engagement.total_likes) },
              {
                label: "Avg likes / comment",
                value: formatNumber(commentAnalytics.engagement.avg_likes_per_comment, 2),
              },
              { label: "Peak hour (UTC)", value: `${commentAnalytics.activity.peak_hour}:00` },
              { label: "Busiest date", value: commentAnalytics.activity.busiest_date ?? "—" },
            ]}
          />

          <StatGrid
            stats={[
              {
                label: "Avg comment length",
                value: `${formatNumber(commentAnalytics.engagement.comment_length.avg, 0)} chars`,
              },
              {
                label: "Median length",
                value: `${formatNumber(commentAnalytics.engagement.comment_length.median, 0)} chars`,
              },
              {
                label: "Max likes (single comment)",
                value: formatNumber(commentAnalytics.engagement.likes_summary.max),
              },
              {
                label: "One-time commenters",
                value: formatNumber(commentAnalytics.commenters.single_comment_users),
              },
            ]}
          />

          <div className="analytics-grid">
            <BarChart title="Comments by date" data={commentAnalytics.activity.by_date} />
            <BarChart title="Comments by hour (UTC)" data={commentAnalytics.activity.by_hour} maxBars={24} />
            <BarChart title="Comments by day of week" data={commentAnalytics.activity.by_day_of_week} maxBars={7} />
            <RankedList
              title="Top commenters by count"
              items={commentAnalytics.commenters.top_by_count}
            />
            <RankedList
              title="Top commenters by total likes"
              items={commentAnalytics.commenters.top_by_likes}
              valueLabel="Likes"
            />
            <RankedList
              title="Most liked comments"
              items={commentAnalytics.top_comments}
              valueLabel="Likes"
            />
            <RankedList
              title="Top words in comments"
              items={commentAnalytics.engagement.top_words.map((w) => ({
                label: w.word,
                value: w.count,
              }))}
              valueLabel="Uses"
            />
          </div>
        </>
      )}
    </div>
  );
}
