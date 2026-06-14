import type { YouTubeChannelStats } from "../youtubeTypes";
import type { YouTubeComment, YouTubeVideo } from "../youtubeTypes";
import type { CountBucket, NumericSummary, RankedItem, UnavailableMetric } from "./types";
import {
  bucketByKey,
  dateLabel,
  dayOfWeekLabel,
  hourLabel,
  numericSummary,
  topWords,
} from "./textUtils";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface YouTubeCommentAnalytics {
  generated_at: string;
  video_id: string;
  video_title: string;
  overview: {
    total_comments: number;
    top_level: number;
    replies: number;
    reply_percent: number;
    unique_commenters: number;
    verified_channels: number;
    first_comment_at: string | null;
    last_comment_at: string | null;
    span_days: number;
    comments_per_day: number;
  };
  engagement: {
    total_likes: number;
    avg_likes_per_comment: number;
    likes_summary: NumericSummary;
    comment_length: NumericSummary;
    top_words: Array<{ word: string; count: number }>;
  };
  activity: {
    by_date: CountBucket[];
    by_hour: CountBucket[];
    by_day_of_week: CountBucket[];
    peak_hour: number;
    busiest_date: string | null;
  };
  commenters: {
    top_by_count: RankedItem[];
    top_by_likes: RankedItem[];
    single_comment_users: number;
  };
  top_comments: RankedItem[];
}

export interface YouTubeChannelAnalytics {
  generated_at: string;
  channel: YouTubeChannelStats | null;
  videos_analyzed: number;
  totals: {
    views: number;
    likes: number;
    comments: number;
    avg_views: number;
    avg_likes: number;
    avg_comments: number;
    engagement_rate_percent: number;
    like_to_view_percent: number;
    comment_to_view_percent: number;
  };
  top_by_views: RankedItem[];
  top_by_likes: RankedItem[];
  top_by_comments: RankedItem[];
  top_by_engagement: RankedItem[];
  publish_by_month: CountBucket[];
  unavailable: UnavailableMetric[];
}

export const YOUTUBE_OAUTH_METRICS: UnavailableMetric[] = [
  { name: "Watch time (hours)", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Average view duration", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Audience retention curve", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Click-through rate (CTR)", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Impressions", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Estimated revenue", reason: "Requires YouTube Analytics API + Google OAuth + monetization" },
  { name: "Subscribers gained/lost", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Traffic sources", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Demographics (age, gender)", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Geography (countries)", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Device & OS breakdown", reason: "Requires YouTube Analytics API + Google OAuth" },
  { name: "Playback locations", reason: "Requires YouTube Analytics API + Google OAuth" },
];

export function analyzeYouTubeComments(
  comments: YouTubeComment[],
  video: YouTubeVideo,
): YouTubeCommentAnalytics {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime(),
  );

  const topLevel = comments.filter((c) => !c.is_reply).length;
  const replies = comments.filter((c) => c.is_reply).length;
  const commenterMap = new Map<string, { name: string; count: number; likes: number }>();
  let verifiedChannels = 0;
  const likes: number[] = [];
  const lengths: number[] = [];
  const texts: string[] = [];

  for (const c of comments) {
    const entry = commenterMap.get(c.author_display_name) ?? {
      name: c.author_display_name,
      count: 0,
      likes: 0,
    };
    entry.count += 1;
    entry.likes += c.like_count;
    commenterMap.set(c.author_display_name, entry);

    if (c.author_channel_id) verifiedChannels += 1;
    likes.push(c.like_count);
    lengths.push(c.text.length);
    if (c.text.trim()) texts.push(c.text);
  }

  const total = comments.length;
  const first = sorted[0]?.published_at ?? null;
  const last = sorted[sorted.length - 1]?.published_at ?? null;
  let spanDays = 1;
  if (first && last) {
    spanDays = Math.max(
      1,
      (new Date(last).getTime() - new Date(first).getTime()) / 86_400_000 + 1,
    );
  }

  const byDate = bucketByKey(comments, (c) => dateLabel(c.published_at));
  const byDateSorted = [...byDate].sort((a, b) => a.label.localeCompare(b.label));
  const busiest = byDateSorted.reduce(
    (best, b) => (b.value > (best?.value ?? 0) ? b : best),
    byDateSorted[0] ?? null,
  );

  const hourCounts = new Map<number, number>();
  for (const c of comments) {
    const h = hourLabel(c.published_at);
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const byHour: CountBucket[] = Array.from({ length: 24 }, (_, h) => ({
    label: `${h.toString().padStart(2, "0")}:00`,
    value: hourCounts.get(h) ?? 0,
  }));
  const peakHourEntry = byHour.reduce((best, b) => (b.value > best.value ? b : best), byHour[0]);

  const dowCounts = new Map<string, number>();
  for (const c of comments) {
    const d = dayOfWeekLabel(c.published_at);
    dowCounts.set(d, (dowCounts.get(d) ?? 0) + 1);
  }
  const byDayOfWeek = DAY_ORDER.map((label) => ({
    label,
    value: dowCounts.get(label) ?? 0,
  }));

  const topByCount: RankedItem[] = [...commenterMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((d) => ({
      label: d.name,
      value: d.count,
      percent: total ? (d.count / total) * 100 : 0,
    }));

  const topByLikes: RankedItem[] = [...commenterMap.values()]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 15)
    .map((d) => ({ label: d.name, value: d.likes }));

  const topComments: RankedItem[] = [...comments]
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, 10)
    .map((c) => ({
      label: c.text.slice(0, 80) + (c.text.length > 80 ? "…" : ""),
      sublabel: c.author_display_name,
      value: c.like_count,
    }));

  return {
    generated_at: new Date().toISOString(),
    video_id: video.id,
    video_title: video.title,
    overview: {
      total_comments: total,
      top_level: topLevel,
      replies,
      reply_percent: total ? (replies / total) * 100 : 0,
      unique_commenters: commenterMap.size,
      verified_channels: verifiedChannels,
      first_comment_at: first,
      last_comment_at: last,
      span_days: Math.round(spanDays),
      comments_per_day: total / spanDays,
    },
    engagement: {
      total_likes: likes.reduce((s, v) => s + v, 0),
      avg_likes_per_comment: total ? likes.reduce((s, v) => s + v, 0) / total : 0,
      likes_summary: numericSummary(likes),
      comment_length: numericSummary(lengths),
      top_words: topWords(texts),
    },
    activity: {
      by_date: byDateSorted,
      by_hour: byHour,
      by_day_of_week: byDayOfWeek,
      peak_hour: parseInt(peakHourEntry.label, 10),
      busiest_date: busiest?.label ?? null,
    },
    commenters: {
      top_by_count: topByCount,
      top_by_likes: topByLikes,
      single_comment_users: [...commenterMap.values()].filter((d) => d.count === 1).length,
    },
    top_comments: topComments,
  };
}

export function analyzeYouTubeChannel(
  videos: YouTubeVideo[],
  channel: YouTubeChannelStats | null,
): YouTubeChannelAnalytics {
  const n = videos.length;
  const totalViews = videos.reduce((s, v) => s + v.view_count, 0);
  const totalLikes = videos.reduce((s, v) => s + v.like_count, 0);
  const totalComments = videos.reduce((s, v) => s + v.comment_count, 0);

  const engagementRates = videos.map((v) =>
    v.view_count ? ((v.like_count + v.comment_count) / v.view_count) * 100 : 0,
  );

  const toRanked = (
    videos: YouTubeVideo[],
    pick: (v: YouTubeVideo) => number,
    limit = 10,
  ): RankedItem[] =>
    [...videos]
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, limit)
      .map((v) => ({ label: v.title, sublabel: v.id, value: pick(v) }));

  const publishByMonth = bucketByKey(videos, (v) => v.published_at.slice(0, 7));

  return {
    generated_at: new Date().toISOString(),
    channel,
    videos_analyzed: n,
    totals: {
      views: totalViews,
      likes: totalLikes,
      comments: totalComments,
      avg_views: n ? totalViews / n : 0,
      avg_likes: n ? totalLikes / n : 0,
      avg_comments: n ? totalComments / n : 0,
      engagement_rate_percent: n
        ? engagementRates.reduce((s, v) => s + v, 0) / n
        : 0,
      like_to_view_percent: totalViews ? (totalLikes / totalViews) * 100 : 0,
      comment_to_view_percent: totalViews ? (totalComments / totalViews) * 100 : 0,
    },
    top_by_views: toRanked(videos, (v) => v.view_count),
    top_by_likes: toRanked(videos, (v) => v.like_count),
    top_by_comments: toRanked(videos, (v) => v.comment_count),
    top_by_engagement: toRanked(
      videos.filter((v) => v.view_count > 0),
      (v) => ((v.like_count + v.comment_count) / v.view_count) * 100,
    ),
    publish_by_month: publishByMonth.sort((a, b) => a.label.localeCompare(b.label)),
    unavailable: YOUTUBE_OAUTH_METRICS,
  };
}
