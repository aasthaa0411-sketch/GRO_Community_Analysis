import { useCallback, useEffect, useState } from "react";
import {
  exportMessages,
  fetchChannels,
  fetchGuilds,
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

export function DiscordTab() {
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customStart, setCustomStart] = useState(toDateInputValue(new Date()));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(new Date()));
  const [userId, setUserId] = useState("");
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<DiscordExportResponse | null>(null);

  const loadGuilds = useCallback(async () => {
    if (!getApiKey()) {
      setError("Save your Export API key in Connection settings first.");
      return;
    }
    setLoadingGuilds(true);
    setError(null);
    try {
      const list = await fetchGuilds();
      setGuilds(list);
      if (list.length === 1) setGuildId(list[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load guilds");
    } finally {
      setLoadingGuilds(false);
    }
  }, []);

  useEffect(() => {
    if (!guildId) {
      setChannels([]);
      setChannelId("");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingChannels(true);
      setError(null);
      try {
        const list = await fetchChannels(guildId);
        if (!cancelled) {
          setChannels(list);
          if (list.length === 1) setChannelId(list[0].id);
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

    const { start, end } = resolveDateRange(datePreset, customStart, customEnd);
    const stamp = new Date().toISOString().slice(0, 10);

    try {
      const result = await exportMessages({
        guildId,
        channelId,
        start,
        end,
        userId: userId.trim() || undefined,
        format,
      });

      if (format === "csv" && result instanceof Blob) {
        downloadBlob(result, `discord-${channelId}-${stamp}.csv`);
        return;
      }

      const payload = result as DiscordExportResponse;
      setLastExport(payload);

      if (format === "json") {
        downloadJson(payload, `discord-${channelId}-${stamp}.json`);
      } else {
        const csv = messagesToCsv(payload.messages);
        downloadText(csv, `discord-${channelId}-${stamp}.csv`, "text/csv");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
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
          {loadingGuilds ? "Loading servers…" : "Load servers"}
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
          User ID <span className="optional">(optional)</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Discord user ID"
          />
        </label>
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => handleExport("json")}
          disabled={exporting || !channelId}
        >
          {exporting ? "Exporting…" : "Export JSON"}
        </button>
        <button
          type="button"
          onClick={() => handleExport("csv")}
          disabled={exporting || !channelId}
        >
          Export CSV
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {lastExport && (
        <p className="meta">
          Last export: {lastExport.message_count} messages from #
          {lastExport.messages[0]?.channel_name ?? channelId}
        </p>
      )}
    </div>
  );
}
