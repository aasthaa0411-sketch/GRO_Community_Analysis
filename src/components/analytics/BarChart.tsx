import type { CountBucket } from "../../lib/analytics/types";

interface BarChartProps {
  title: string;
  data: CountBucket[];
  maxBars?: number;
}

export function BarChart({ title, data, maxBars = 30 }: BarChartProps) {
  const shown = data.length > maxBars ? data.slice(-maxBars) : data;
  const max = Math.max(...shown.map((d) => d.value), 1);

  if (shown.length === 0) {
    return (
      <div className="chart-block">
        <h4>{title}</h4>
        <p className="meta">No data</p>
      </div>
    );
  }

  return (
    <div className="chart-block">
      <h4>{title}</h4>
      <div className="bar-chart">
        {shown.map((item) => (
          <div key={item.label} className="bar-row">
            <span className="bar-label" title={item.label}>
              {item.label}
            </span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <span className="bar-value">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
