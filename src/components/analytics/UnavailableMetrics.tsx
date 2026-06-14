import type { UnavailableMetric } from "../../lib/analytics/types";

interface UnavailableMetricsProps {
  title: string;
  metrics: UnavailableMetric[];
}

export function UnavailableMetrics({ title, metrics }: UnavailableMetricsProps) {
  return (
    <div className="unavailable-block">
      <h4>{title}</h4>
      <p className="hint">
        These metrics need additional API access and are not available with the current setup.
      </p>
      <ul className="unavailable-list">
        {metrics.map((m) => (
          <li key={m.name}>
            <strong>{m.name}</strong> — {m.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
