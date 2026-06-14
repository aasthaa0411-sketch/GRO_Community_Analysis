import { useCallback, useEffect, useState } from "react";
import { getYouTubeApiKey, setYouTubeApiKey } from "../lib/config";
import {
  downloadJson,
  downloadText,
  resolveDateRange,
  toDateInputValue,
  youtubeCommentsToCsv,
  type DatePreset,
} from "../lib/exportUtils";
import {
  getYouTubeCache,
  getYouTubePrefs,
  setYouTubeCache,
  setYouTubePrefs,
} from "../lib/tabPrefs";
import {
  exportVideoComments,
  fetchChannelStats,
  fetchChannelVideos,
  resolveChannelId,
} from "../lib/youtubeApi";
import type { YouTubeExportResponse, YouTubeVideo } from "../lib/youtubeTypes";
import {
  analyzeYouTubeChannel,
  analyzeYouTubeComments,
  type YouTubeChannelAnalytics,
  type YouTubeCommentAnalytics,
} from "../lib/analytics/youtubeAnalytics";
import { YouTubeAnalyticsPanel } from "../components/analytics/YouTubeAnalyticsPanel";

function pickVideo(list: YouTubeVideo[], savedVideoId: string): string {
  if (savedVideoId && list.some((v) => v.id === savedVideoId)) return savedVideoId;
  if (list.length === 1) return list[0].id;
  return "";
}

function loadInitialState() {
  const prefs = getYouTubePrefs();
  const cache = getYouTubeCache();
  const today = toDateInputValue(new Date());

  return {
    prefs: {
      ...prefs,
      customStart: prefs.customStart || today,
      customEnd: prefs.customEnd || today,
    },
    videos:
      cache && cache.channelId === prefs.resolvedChannelId ? cache.videos : [],
  };
}

export function YouTubeTab() {
  const initial = loadInitialState();

  const [apiKey, setApiKeyState] = useState(getYouTubeApiKey());
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [channelInput, setChannelInput] = useState(initial.prefs.channelInput);
  const [resolvedChannelId, setResolvedChannelId] = useState(initial.prefs.resolvedChannelId);
  const [videos, setVideos] = useState<YouTubeVideo[]>(initial.videos);
  const [videoId, setVideoId] = useState(initial.prefs.videoId);
  const [includeReplies, setIncludeReplies] = useState(initial.prefs.includeReplies);
  const [datePreset, setDatePreset] = useState<DatePreset>(initial.prefs.datePreset);
  const [customStart, setCustomStart] = useState(initial.prefs.customStart);
  const [customEnd, setCustomEnd] = useState(initial.prefs.customEnd);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [commentAnalytics, setCommentAnalytics] = useState<YouTubeCommentAnalytics | null>(null);
  const [channelAnalytics, setChannelAnalytics] = useState<YouTubeChannelAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<YouTubeExportResponse | null>(null);

  useEffect(() => {
    setYouTubePrefs({
      channelInput,
      resolvedChannelId,
      videoId,
      includeReplies,
      datePreset,
      customStart,
      customEnd,
    });
  }, [
    channelInput,
    resolvedChannelId,
    videoId,
    includeReplies,
    datePreset,
    customStart,
    customEnd,
  ]);

  useEffect(() => {
    if (resolvedChannelId && videos.length > 0) {
      setYouTubeCache({ videos, channelId: resolvedChannelId });
    }
  }, [videos, resolvedChannelId]);

  function handleSaveApiKey() {
    setYouTubeApiKey(apiKey.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  const loadVideos = useCallback(async () => {
    if (!getYouTubeApiKey()) {
      setError("Save your YouTube API key first.");
      return;
    }
    if (!channelInput.trim()) {
      setError("Enter a channel ID, @handle, or channel URL.");
      return;
    }

    setLoadingVideos(true);
    setError(null);

    try {
      const channelId = await resolveChannelId(channelInput);
      setResolvedChannelId(channelId);
      const list = await fetchChannelVideos(channelId);
      setVideos(list);
      const savedVideoId = getYouTubePrefs().videoId;
      const nextVideoId = pickVideo(list, savedVideoId);
      if (nextVideoId) setVideoId(nextVideoId);
      else setVideoId("");
      setYouTubeCache({ videos: list, channelId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setLoadingVideos(false);
    }
  }, [channelInput]);

  useEffect(() => {
    if (
      getYouTubeApiKey() &&
      channelInput.trim() &&
      videos.length === 0 &&
      !loadingVideos
    ) {
      void loadVideos();
    }
  }, [channelInput, videos.length, loadingVideos, loadVideos]);

  async function handleExport(format: "json" | "csv") {
    const video = videos.find((v) => v.id === videoId);
    if (!video) {
      setError("Select a video to export.");
      return;
    }

    setExporting(true);
    setError(null);

    const { start, end } = resolveDateRange(datePreset, customStart, customEnd);
    const stamp = new Date().toISOString().slice(0, 10);
    const safeTitle = video.title.replace(/[^\w.-]+/g, "_").slice(0, 40);

    try {
      const payload = await exportVideoComments(video, {
        includeReplies,
        start,
        end,
      });

      setLastExport(payload);

      if (format === "json") {
        downloadJson(payload, `youtube-${safeTitle}-${stamp}.json`);
      } else {
        const csv = youtubeCommentsToCsv(payload.comments);
        downloadText(csv, `youtube-${safeTitle}-${stamp}.csv`, "text/csv");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleAnalyze() {
    if (videos.length === 0) {
      setError("Load channel videos first.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const { start, end } = resolveDateRange(datePreset, customStart, customEnd);

    try {
      const channelStats = resolvedChannelId
        ? await fetchChannelStats(resolvedChannelId)
        : null;
      setChannelAnalytics(analyzeYouTubeChannel(videos, channelStats));

      const video = videos.find((v) => v.id === videoId);
      if (video) {
        const payload = await exportVideoComments(video, {
          includeReplies,
          start,
          end,
        });
        setLastExport(payload);
        setCommentAnalytics(analyzeYouTubeComments(payload.comments, video));
      } else {
        setCommentAnalytics(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const selectedVideo = videos.find((v) => v.id === videoId);

  return (
    <div className="tab-panel">
      <header className="tab-header">
        <h2>YouTube export</h2>
        <p>
          Export video comments and replies using the YouTube Data API v3. Analytics
          (watch time, revenue) require OAuth and are planned for a later phase.
        </p>
      </header>

      <section className="subsection">
        <h3>API key</h3>
        <p className="hint">
          Create a key in{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
          >
            Google Cloud Console
          </a>{" "}
          with <strong>YouTube Data API v3</strong> enabled. Saved locally until you change it.
        </p>
        <label>
          YouTube API key
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyState(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
          />
        </label>
        <div className="toolbar">
          <button type="button" onClick={handleSaveApiKey}>
            Save API key
          </button>
          {apiKeySaved && <span className="success">Saved</span>}
        </div>
      </section>

      <section className="subsection">
        <h3>Channel &amp; video</h3>
        <div className="form-grid">
          <label>
            Channel
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="UC…, @handle, or youtube.com/channel/…"
            />
          </label>
        </div>
        <div className="toolbar">
          <button type="button" onClick={loadVideos} disabled={loadingVideos}>
            {loadingVideos ? "Loading videos…" : "Refresh videos"}
          </button>
          {resolvedChannelId && (
            <span className="meta">Channel ID: {resolvedChannelId}</span>
          )}
        </div>

        <div className="form-grid">
          <label>
            Video
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              disabled={videos.length === 0}
            >
              <option value="">Select video</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title} ({v.comment_count} comments)
                </option>
              ))}
            </select>
          </label>

          {selectedVideo && (
            <p className="meta">
              {selectedVideo.view_count.toLocaleString()} views ·{" "}
              {selectedVideo.like_count.toLocaleString()} likes · published{" "}
              {selectedVideo.published_at.slice(0, 10)}
            </p>
          )}

          <label>
            Date range
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 3 months</option>
              <option value="custom">Custom range</option>
            </select>
          </label>

          {datePreset === "custom" && (
            <>
              <label>
                From
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
            </>
          )}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeReplies}
              onChange={(e) => setIncludeReplies(e.target.checked)}
            />
            Include reply comments
          </label>
        </div>
      </section>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => handleExport("json")}
          disabled={exporting || analyzing || !videoId}
        >
          {exporting ? "Exporting comments…" : "Export JSON"}
        </button>
        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={exporting || analyzing || !videoId}
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing || videos.length === 0}
        >
          {analyzing ? "Analyzing…" : "Run analytics"}
        </button>
        {(commentAnalytics || channelAnalytics) && (
          <button
            type="button"
            onClick={() =>
              downloadJson(
                { channel: channelAnalytics, comments: commentAnalytics },
                `youtube-analytics-${resolvedChannelId || "channel"}.json`,
              )
            }
          >
            Download analytics JSON
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {(commentAnalytics || channelAnalytics) && (
        <YouTubeAnalyticsPanel
          commentAnalytics={commentAnalytics}
          channelAnalytics={channelAnalytics}
        />
      )}

      {lastExport && !commentAnalytics && !channelAnalytics && (
        <p className="meta">
          Last export: {lastExport.count} comments from &ldquo;{lastExport.video.title}&rdquo;
        </p>
      )}
    </div>
  );
}
