export interface YouTubeVideo {
  id: string;
  title: string;
  published_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
}

export interface YouTubeChannelStats {
  id: string;
  title: string;
  custom_url: string | null;
  published_at: string;
  subscriber_count: number;
  total_views: number;
  video_count: number;
  hidden_subscriber_count: boolean;
}

export interface YouTubeComment {
  id: string;
  video_id: string;
  parent_id: string | null;
  author_channel_id: string | null;
  author_display_name: string;
  text: string;
  like_count: number;
  published_at: string;
  updated_at: string;
  is_reply: boolean;
}

export interface YouTubeExportResponse {
  platform: "youtube";
  exported_at: string;
  video: YouTubeVideo;
  filters: {
    start: string | null;
    end: string | null;
    include_replies: boolean;
  };
  count: number;
  comments: YouTubeComment[];
}
