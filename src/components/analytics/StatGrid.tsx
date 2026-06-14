interface StatGridProps {
  stats: Array<{ label: string; value: string; hint?: string }>;
}

export function StatGrid({ stats }: StatGridProps) {
  return (
    <div className="stat-grid">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card">
          <span className="stat-label">{stat.label}</span>
          <span className="stat-value">{stat.value}</span>
          {stat.hint && <span className="stat-hint">{stat.hint}</span>}
        </div>
      ))}
    </div>
  );
}
