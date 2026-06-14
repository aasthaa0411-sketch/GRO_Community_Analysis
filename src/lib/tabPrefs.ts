import type { DiscordChannel, DiscordGuild } from "./discordTypes";
import type { DatePreset } from "./exportUtils";
import type { YouTubeVideo } from "./youtubeTypes";

const ACTIVE_TAB_KEY = "gro_active_tab";
const DISCORD_PREFS_KEY = "gro_discord_prefs";
const DISCORD_CACHE_KEY = "gro_discord_cache";
const YOUTUBE_PREFS_KEY = "gro_youtube_prefs";
const YOUTUBE_CACHE_KEY = "gro_youtube_cache";

export type TabId = "discord" | "youtube" | "tiktok";

export interface DiscordPrefs {
  guildId: string;
  channelId: string;
  userId: string;
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
}

export interface DiscordCache {
  guilds: DiscordGuild[];
  channels: DiscordChannel[];
  channelsGuildId: string;
}

export interface YouTubePrefs {
  channelInput: string;
  resolvedChannelId: string;
  videoId: string;
  includeReplies: boolean;
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
}

export interface YouTubeCache {
  videos: YouTubeVideo[];
  channelId: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const DEFAULT_DISCORD_PREFS: DiscordPrefs = {
  guildId: "",
  channelId: "",
  userId: "",
  datePreset: "today",
  customStart: "",
  customEnd: "",
};

const DEFAULT_YOUTUBE_PREFS: YouTubePrefs = {
  channelInput: "",
  resolvedChannelId: "",
  videoId: "",
  includeReplies: true,
  datePreset: "30d",
  customStart: "",
  customEnd: "",
};

export function getActiveTab(): TabId {
  const tab = localStorage.getItem(ACTIVE_TAB_KEY);
  if (tab === "discord" || tab === "youtube" || tab === "tiktok") return tab;
  return "discord";
}

export function setActiveTab(tab: TabId): void {
  localStorage.setItem(ACTIVE_TAB_KEY, tab);
}

export function getDiscordPrefs(): DiscordPrefs {
  return { ...DEFAULT_DISCORD_PREFS, ...readJson<Partial<DiscordPrefs>>(DISCORD_PREFS_KEY) };
}

export function setDiscordPrefs(prefs: DiscordPrefs): void {
  writeJson(DISCORD_PREFS_KEY, prefs);
}

export function getDiscordCache(): DiscordCache | null {
  return readJson<DiscordCache>(DISCORD_CACHE_KEY);
}

export function setDiscordCache(cache: DiscordCache): void {
  writeJson(DISCORD_CACHE_KEY, cache);
}

export function getYouTubePrefs(): YouTubePrefs {
  return { ...DEFAULT_YOUTUBE_PREFS, ...readJson<Partial<YouTubePrefs>>(YOUTUBE_PREFS_KEY) };
}

export function setYouTubePrefs(prefs: YouTubePrefs): void {
  writeJson(YOUTUBE_PREFS_KEY, prefs);
}

export function getYouTubeCache(): YouTubeCache | null {
  return readJson<YouTubeCache>(YOUTUBE_CACHE_KEY);
}

export function setYouTubeCache(cache: YouTubeCache): void {
  writeJson(YOUTUBE_CACHE_KEY, cache);
}
