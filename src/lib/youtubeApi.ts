import { getYouTubeApiKey } from "./config";
import type { YouTubeChannelStats, YouTubeComment, YouTubeExportResponse, YouTubeVideo } from "./youtubeTypes";

const API_BASE = "https://www.googleapis.com/youtube/v3";

interface GoogleApiError {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

function friendlyYouTubeError(status: number, message: string, reason?: string): string {
  if (status === 403) {
    if (reason === "quotaExceeded" || message.includes("quota")) {
      return "YouTube API quota exceeded. Try again tomorrow or increase quota in Google Cloud Console.";
    }
    if (reason === "commentsDisabled") {
      return "Comments are disabled on this video.";
    }
    return message || "Forbidden — check that YouTube Data API v3 is enabled and your API key is valid.";
  }
  if (status === 400) {
    return message || "Invalid request — check channel or video ID.";
  }
  if (status === 404) {
    return "Channel or video not found.";
  }
  return message || `YouTube API request failed (${status})`;
}

async function youtubeFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const apiKey = getYouTubeApiKey();
  if (!apiKey) {
    throw new Error("Save your YouTube API key in the YouTube tab first.");
  }

  const search = new URLSearchParams({ ...params, key: apiKey });
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}?${search}`);
  } catch {
    throw new Error("Could not reach YouTube API. Check your internet connection.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let reason: string | undefined;
    try {
      const body = (await res.json()) as GoogleApiError;
      if (body.error?.message) message = body.error.message;
      reason = body.error?.errors?.[0]?.reason;
    } catch {
      // ignore
    }
    throw new Error(friendlyYouTubeError(res.status, message, reason));
  }

  return res.json() as Promise<T>;
}

export function uploadsPlaylistId(channelId: string): string {
  if (channelId.startsWith("UC")) {
    return `UU${channelId.slice(2)}`;
  }
  return channelId;
}

export function normalizeChannelInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) return trimmed;
  if (trimmed.includes("youtube.com")) {
    const handleMatch = trimmed.match(/youtube\.com\/@([^/?]+)/);
    if (handleMatch) return `@${handleMatch[1]}`;
    const channelMatch = trimmed.match(/youtube\.com\/channel\/([^/?]+)/);
    if (channelMatch) return channelMatch[1];
  }
  return trimmed;
}

interface ChannelListResponse {
  items?: Array<{ id: string }>;
}

export async function resolveChannelId(input: string): Promise<string> {
  const normalized = normalizeChannelInput(input);
  if (!normalized) throw new Error("Enter a channel ID, @handle, or channel URL.");

  if (normalized.startsWith("@")) {
    const data = await youtubeFetch<ChannelListResponse>("/channels", {
      part: "id",
      forHandle: normalized.slice(1),
    });
    const id = data.items?.[0]?.id;
    if (!id) throw new Error(`Channel not found for handle ${normalized}.`);
    return id;
  }

  if (/^UC[\w-]{22}$/.test(normalized)) return normalized;

  throw new Error("Unrecognized channel format. Use UC… channel ID, @handle, or a youtube.com/channel/… URL.");
}

interface ChannelStatsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      publishedAt?: string;
    };
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
      hiddenSubscriberCount?: boolean;
    };
  }>;
}

export async function fetchChannelStats(
  channelId: string,
): Promise<YouTubeChannelStats | null> {
  const data = await youtubeFetch<ChannelStatsResponse>("/channels", {
    part: "snippet,statistics",
    id: channelId,
  });

  const item = data.items?.[0];
  if (!item) return null;

  return {
    id: item.id,
    title: item.snippet?.title ?? channelId,
    custom_url: item.snippet?.customUrl ?? null,
    published_at: item.snippet?.publishedAt ?? "",
    subscriber_count: Number(item.statistics?.subscriberCount ?? 0),
    total_views: Number(item.statistics?.viewCount ?? 0),
    video_count: Number(item.statistics?.videoCount ?? 0),
    hidden_subscriber_count: item.statistics?.hiddenSubscriberCount ?? false,
  };
}

interface PlaylistItemsResponse {
  items?: Array<{
    snippet?: {
      resourceId?: { videoId?: string };
      title?: string;
      publishedAt?: string;
    };
  }>;
  nextPageToken?: string;
}

interface VideosListResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

export async function fetchChannelVideos(
  channelId: string,
  maxVideos = 50,
): Promise<YouTubeVideo[]> {
  const playlistId = uploadsPlaylistId(channelId);
  const videoIds: Array<{ id: string; title: string; publishedAt: string }> = [];
  let pageToken: string | undefined;

  while (videoIds.length < maxVideos) {
    const params: Record<string, string> = {
      part: "snippet",
      playlistId,
      maxResults: String(Math.min(50, maxVideos - videoIds.length)),
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeFetch<PlaylistItemsResponse>("/playlistItems", params);

    for (const item of data.items ?? []) {
      const id = item.snippet?.resourceId?.videoId;
      if (!id) continue;
      videoIds.push({
        id,
        title: item.snippet?.title ?? id,
        publishedAt: item.snippet?.publishedAt ?? "",
      });
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  if (videoIds.length === 0) return [];

  const details = await youtubeFetch<VideosListResponse>("/videos", {
    part: "snippet,statistics",
    id: videoIds.map((v) => v.id).join(","),
  });

  const statsById = new Map(
    (details.items ?? []).map((item) => [
      item.id,
      {
        view_count: Number(item.statistics?.viewCount ?? 0),
        like_count: Number(item.statistics?.likeCount ?? 0),
        comment_count: Number(item.statistics?.commentCount ?? 0),
        title: item.snippet?.title ?? item.id,
        published_at: item.snippet?.publishedAt ?? "",
      },
    ]),
  );

  return videoIds.map((v) => {
    const stats = statsById.get(v.id);
    return {
      id: v.id,
      title: stats?.title ?? v.title,
      published_at: stats?.published_at ?? v.publishedAt,
      view_count: stats?.view_count ?? 0,
      like_count: stats?.like_count ?? 0,
      comment_count: stats?.comment_count ?? 0,
    };
  });
}

interface CommentThreadsResponse {
  items?: Array<{
    id: string;
    snippet?: {
      topLevelComment?: {
        id?: string;
        snippet?: {
          authorChannelId?: { value?: string };
          authorDisplayName?: string;
          textDisplay?: string;
          likeCount?: number;
          publishedAt?: string;
          updatedAt?: string;
        };
      };
    };
    replies?: {
      comments?: Array<{
        id: string;
        snippet?: {
          authorChannelId?: { value?: string };
          authorDisplayName?: string;
          textDisplay?: string;
          likeCount?: number;
          publishedAt?: string;
          updatedAt?: string;
          parentId?: string;
        };
      }>;
    };
  }>;
  nextPageToken?: string;
}

interface CommentSnippet {
  authorChannelId?: { value?: string };
  authorDisplayName?: string;
  textDisplay?: string;
  likeCount?: number;
  publishedAt?: string;
  updatedAt?: string;
  parentId?: string;
}

function mapComment(
  videoId: string,
  id: string,
  snippet: CommentSnippet | undefined,
  parentId: string | null,
  isReply: boolean,
): YouTubeComment {
  return {
    id,
    video_id: videoId,
    parent_id: parentId,
    author_channel_id: snippet?.authorChannelId?.value ?? null,
    author_display_name: snippet?.authorDisplayName ?? "",
    text: snippet?.textDisplay ?? "",
    like_count: snippet?.likeCount ?? 0,
    published_at: snippet?.publishedAt ?? "",
    updated_at: snippet?.updatedAt ?? "",
    is_reply: isReply,
  };
}

export interface FetchCommentsOptions {
  videoId: string;
  includeReplies: boolean;
  maxComments?: number;
  start?: string;
  end?: string;
}

export async function fetchVideoComments(
  options: FetchCommentsOptions,
): Promise<YouTubeComment[]> {
  const { videoId, includeReplies, maxComments = 5000, start, end } = options;
  const comments: YouTubeComment[] = [];
  let pageToken: string | undefined;

  while (comments.length < maxComments) {
    const params: Record<string, string> = {
      part: "snippet,replies",
      videoId,
      maxResults: "100",
      order: "time",
      textFormat: "plainText",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeFetch<CommentThreadsResponse>("/commentThreads", params);

    for (const thread of data.items ?? []) {
      const top = thread.snippet?.topLevelComment;
      const topId = top?.id;
      const topSnippet = top?.snippet;
      if (!topId || !topSnippet) continue;

      const publishedAt = topSnippet.publishedAt ?? "";
      if (start && publishedAt < start) continue;
      if (end && publishedAt > end) continue;

      comments.push(mapComment(videoId, topId, topSnippet, null, false));
      if (comments.length >= maxComments) break;

      if (includeReplies) {
        for (const reply of thread.replies?.comments ?? []) {
          const replySnippet = reply.snippet;
          if (!replySnippet) continue;

          const replyPublished = replySnippet.publishedAt ?? "";
          if (start && replyPublished < start) continue;
          if (end && replyPublished > end) continue;

          comments.push(
            mapComment(videoId, reply.id, replySnippet, topId, true),
          );
          if (comments.length >= maxComments) break;
        }
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken || comments.length >= maxComments) break;
  }

  return comments;
}

export async function exportVideoComments(
  video: YouTubeVideo,
  options: Omit<FetchCommentsOptions, "videoId">,
): Promise<YouTubeExportResponse> {
  const comments = await fetchVideoComments({ ...options, videoId: video.id });

  return {
    platform: "youtube",
    exported_at: new Date().toISOString(),
    video,
    filters: {
      start: options.start ?? null,
      end: options.end ?? null,
      include_replies: options.includeReplies,
    },
    count: comments.length,
    comments,
  };
}
