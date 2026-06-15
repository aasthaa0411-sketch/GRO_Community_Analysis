import { useCallback, useEffect, useState } from "react";
import {
  exportMessages,
  fetchChannels,
  fetchGuilds,
  GRO_GUILD_ID,
} from "../lib/discordApi";
import type { DiscordChannel, DiscordExportResponse, DiscordGuild } from "../lib/discordTypes";
import {
  downloadBlob,
  downloadJson,
  downloadText,
  messagesToCsv,
  resolveDateRange,
  toDateInputValue,
  type DatePreset,
} from "../lib/exportUtils";
import { getApiKey } from "../lib/config";
import {
  getDiscordCache,
  getDiscordPrefs,
  setDiscordCache,
  setDiscordPrefs,
} from "../lib/tabPrefs";
import { analyzeDiscordMessages, type DiscordAnalytics } from "../lib/analytics/discordAnalytics";
import { DiscordAnalyticsPanel } from "../components/analytics/DiscordAnalyticsPanel";

function pickDefaultGuild(list: DiscordGuild[], savedGuildId: string): string {
  if (savedGuildId && list.some((g) => g.id === savedGuildId)) return savedGuildId;
  if (list.some((g) => g.id === GRO_GUILD_ID)) return GRO_GUILD_ID;
  if (list.length === 1) return list[0].id;
  return "";
}

function pickChannel(list: DiscordChannel[], savedChannelId: string): string {
  if (savedChannelId && list.some((c) => c.id === savedChannelId)) return savedChannelId;
  if (list.length === 1) return list[0].id;
  return "";
}

function emptyUserFilterWarning(
  count: number,
  userId: string,
): string | null {
  const trimmed = userId.trim();
  if (count > 0 || !trimmed) return null;
  return `No messages found for "${trimmed}" in the selected channel and date range. Check the username or server display name.`;
}

function allContentEmpty(messages: DiscordExportResponse["messages"]): boolean {
  return messages.length > 0 && messages.every((m) => !m.content.trim());
}

function loadInitialState() {
  const prefs = getDiscordPrefs();
  const cache = getDiscordCache();
  const today = toDateInputValue(new Date());

  return {
    prefs: {
      ...prefs,
      customStart: prefs.customStart || today,
      customEnd: prefs.customEnd || today,
    },
    guilds: cache?.guilds ?? [],
    channels:
      cache && cache.channelsGuildId === prefs.guildId ? cache.channels : [],
  };
}

export function DiscordTab() {
  const initial = loadInitialState();

  const [guilds, setGuilds] = useState<DiscordGuild[]>(initial.guilds);
  const [channels, setChannels] = useState<DiscordChannel[]>(initial.channels);
  const [guildId, setGuildId] = useState(initial.prefs.guildId);
  const [channelId, setChannelId] = useState(initial.prefs.channelId);
  const [datePreset, setDatePreset] = useState<DatePreset>(initial.prefs.datePreset);
  const [customStart, setCustomStart] = useState(initial.prefs.customStart);
  const [customEnd, setCustomEnd] = useState(initial.prefs.customEnd);
  const [userId, setUserId] = useState(initial.prefs.userId);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analytics, setAnalytics] = useState<DiscordAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<DiscordExportResponse | null>(null);

  useEffect(() => {
    setDiscordPrefs({
      guildId,
      channelId,
      userId,
      datePreset,
      customStart,
      customEnd,
    });
  }, [guildId, channelId, userId, datePreset, customStart, customEnd]);

  useEffect(() => {
    const cache = getDiscordCache();
    if (cache) {
      setDiscordCache({ ...cache, guilds, channels, channelsGuildId: guildId });
    } else if (guilds.length > 0) {
      setDiscordCache({ guilds, channels, channelsGuildId: guildId });
    }
  }, [guilds, channels, guildId]);

  const loadGuilds = useCallback(async () => {
    if (!getApiKey()) {
      setError("Save your Export API key in Connection settings first.");
      return;
    }
    setLoadingGuilds(true);
    setError(null);
    setWarning(null);
    try {
      const list = await fetchGuilds();
      setGuilds(list);
      const savedGuildId = getDiscordPrefs().guildId;
      const nextGuildId = pickDefaultGuild(list, savedGuildId);
      if (nextGuildId) setGuildId(nextGuildId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load guilds");
    } finally {
      setLoadingGuilds(false);
    }
  }, []);

  useEffect(() => {
    if (getApiKey() && guilds.length === 0) {
      void loadGuilds();
    }
  }, [guilds.length, loadGuilds]);

  useEffect(() => {
    if (!guildId) {
      setChannels([]);
      setChannelId("");
      return;
    }

    if (
      getDiscordCache()?.channelsGuildId === guildId &&
      getDiscordCache()?.channels.length
    ) {
      const cached = getDiscordCache()!.channels;
      setChannels(cached);
      const savedChannelId = getDiscordPrefs().channelId;
      const nextChannelId = pickChannel(cached, savedChannelId);
      if (nextChannelId) setChannelId(nextChannelId);
      return;
    }

    setChannels([]);
    setChannelId("");
    let cancelled = false;
    (async () => {
      setLoadingChannels(true);
      setError(null);
      try {
        const list = await fetchChannels(guildId);
        if (!cancelled) {
          setChannels(list);
          const savedChannelId = getDiscordPrefs().channelId;
          const nextChannelId = pickChannel(list, savedChannelId);
          if (nextChannelId) setChannelId(nextChannelId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load channels");
        }
      } finally {
        if (!cancelled) setLoadingChannels(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  async function handleExport(format: "json" | "csv") {
    if (!guildId || !channelId) {
      setError("Select a server and channel.");
      return;
    }

    setExporting(true);
    setError(null);
    setWarning(null);

    const { start, end } = resolveDateRange(datePreset, customStart, customEnd);
    const stamp = new Date().toISOString().slice(0, 10);
    const channelName = channels.find((c) => c.id === channelId)?.name ?? channelId;

    try {
      const { data: result, filename } = await exportMessages({
        guildId,
        channelId,
        start,
        end,
        userId: userId.trim() || undefined,
        format,
      });

      if (format === "csv" && result instanceof Blob) {
        downloadBlob(
          result,
          filename ?? `discord-export-${guildId}-${channelId}.csv`,
        );
        return;
      }

      const payload = result as DiscordExportResponse;
      setLastExport(payload);

      const userFilterWarning = emptyUserFilterWarning(payload.count, userId);
      if (userFilterWarning) {
        setWarning(userFilterWarning);
      } else if (allContentEmpty(payload.messages)) {
        setWarning(
          "All exported messages have empty content. Message Content Intent may not be approved yet in the Discord Developer Portal.",
        );
      }

      if (format === "json") {
        downloadJson(payload, filename ?? `discord-${channelName}-${stamp}.json`);
      } else {
        const csv = messagesToCsv(payload.messages);
        downloadText(
          csv,
          filename ?? `discord-export-${guildId}-${channelId}.csv`,
          "text/csv",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handleAnalyze() {
    if (!guildId || !channelId) {
      setError("Select a server and channel.");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setWarning(null);

    const { start, end } = resolveDateRange(datePreset, customStart, customEnd);

    try {
      const { data: result } = await exportMessages({
        guildId,
        channelId,
        start,
        end,
        userId: userId.trim() || undefined,
        format: "json",
      });

      const payload = result as DiscordExportResponse;
      setLastExport(payload);

      const userFilterWarning = emptyUserFilterWarning(payload.count, userId);
      if (userFilterWarning) {
        setWarning(userFilterWarning);
      } else if (allContentEmpty(payload.messages)) {
        setWarning(
          "All messages have empty content. Word/length analytics will be limited until Message Content Intent is approved.",
        );
      }

      setAnalytics(
        analyzeDiscordMessages(payload.messages, channelId, {
          start: payload.filters.start,
          end: payload.filters.end,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="tab-panel">
      <header className="tab-header">
        <h2>Discord export</h2>
        <p>Fetch chat logs from your bot with channel, date, and user filters.</p>
      </header>

      <div className="toolbar">
        <button type="button" onClick={loadGuilds} disabled={loadingGuilds}>
          {loadingGuilds ? "Loading servers…" : "Refresh servers"}
        </button>
      </div>

      <div className="form-grid">
        <label>
          Server
          <select
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
            disabled={guilds.length === 0}
          >
            <option value="">Select server</option>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Channel
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            disabled={!guildId || loadingChannels || channels.length === 0}
          >
            <option value="">
              {loadingChannels ? "Loading channels…" : "Select channel"}
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </label>

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

        <label>
          Username or user ID <span className="optional">(optional)</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="e.g. lealan12 or 123456789012345678"
          />
          <span className="hint">
            Enter a Discord @username, server display name, or numeric user ID.
          </span>
        </label>
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => handleExport("json")}
          disabled={exporting || analyzing || !channelId}
        >
          {exporting ? "Exporting… (large channels may take a few minutes)" : "Export JSON"}
        </button>
        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={exporting || analyzing || !channelId}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={exporting || analyzing || !channelId}
        >
          {analyzing ? "Analyzing…" : "Run analytics"}
        </button>
        {analytics && (
          <button
            type="button"
            onClick={() => downloadJson(analytics, `discord-analytics-${channelId}.json`)}
          >
            Download analytics JSON
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {warning && <p className="warning">{warning}</p>}

      {analytics && <DiscordAnalyticsPanel analytics={analytics} />}

      {lastExport && !analytics && (
        <p className="meta">
          Last export: {lastExport.count} messages from #
          {channels.find((c) => c.id === lastExport.channel_id)?.name ?? lastExport.channel_id}
        </p>
      )}
    </div>
  );
}
