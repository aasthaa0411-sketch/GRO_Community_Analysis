const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "is", "it",
  "this", "that", "with", "as", "by", "from", "be", "are", "was", "were", "been", "have",
  "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might",
  "can", "i", "you", "he", "she", "we", "they", "my", "your", "his", "her", "our", "their",
  "me", "him", "us", "them", "what", "which", "who", "when", "where", "why", "how", "all",
  "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor",
  "not", "only", "own", "same", "so", "than", "too", "very", "just", "about", "into",
  "through", "during", "before", "after", "above", "below", "up", "down", "out", "off",
  "over", "under", "again", "further", "then", "once", "here", "there", "any", "if",
  "because", "until", "while", "im", "its", "dont", "didnt", "cant", "wont", "youre",
  "theyre", "we're", "it's", "thats", "theres", "heres",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9']+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.replace(/'/g, "")));
}

export function topWords(texts: string[], limit = 20): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>();
  for (const text of texts) {
    for (const word of tokenize(text)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function numericSummary(values: number[]): import("./types").NumericSummary {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, total: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const total = values.reduce((sum, v) => sum + v, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: total / values.length,
    median,
    total,
  };
}

export function bucketByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
): import("./types").CountBucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function formatNumber(n: number, decimals = 0): string {
  if (decimals > 0) return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  return Math.round(n).toLocaleString();
}

export function formatPercent(part: number, total: number): string {
  if (total === 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function dayOfWeekLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export function hourLabel(iso: string): number {
  return new Date(iso).getUTCHours();
}

export function dateLabel(iso: string): string {
  return iso.slice(0, 10);
}
