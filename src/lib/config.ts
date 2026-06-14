export const DEFAULT_BOT_URL = "https://gro-discord-bot.onrender.com";

const BOT_URL_KEY = "gro_bot_url";
const API_KEY_KEY = "gro_export_api_key";

export function getBotUrl(): string {
  return localStorage.getItem(BOT_URL_KEY) ?? DEFAULT_BOT_URL;
}

export function setBotUrl(url: string): void {
  localStorage.setItem(BOT_URL_KEY, url);
}

export function getApiKey(): string {
  return sessionStorage.getItem(API_KEY_KEY) ?? "";
}

export function setApiKey(key: string): void {
  sessionStorage.setItem(API_KEY_KEY, key);
}

export function authHeaders(): HeadersInit {
  const key = getApiKey();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

const YOUTUBE_API_KEY = "gro_youtube_api_key";

export function getYouTubeApiKey(): string {
  return localStorage.getItem(YOUTUBE_API_KEY) ?? "";
}

export function setYouTubeApiKey(key: string): void {
  localStorage.setItem(YOUTUBE_API_KEY, key);
}
