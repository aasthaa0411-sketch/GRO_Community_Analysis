export interface CountBucket {
  label: string;
  value: number;
}

export interface RankedItem {
  label: string;
  value: number;
  sublabel?: string;
  percent?: number;
}

export interface NumericSummary {
  min: number;
  max: number;
  avg: number;
  median: number;
  total: number;
}

export interface UnavailableMetric {
  name: string;
  reason: string;
}
