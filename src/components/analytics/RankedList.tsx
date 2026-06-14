import type { RankedItem } from "../../lib/analytics/types";

interface RankedListProps {
  title: string;
  items: RankedItem[];
  valueLabel?: string;
}

export function RankedList({ title, items, valueLabel = "Count" }: RankedListProps) {
  if (items.length === 0) {
    return (
      <div className="ranked-block">
        <h4>{title}</h4>
        <p className="meta">No data</p>
      </div>
    );
  }

  return (
    <div className="ranked-block">
      <h4>{title}</h4>
      <table className="ranked-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={`${item.label}-${i}`}>
              <td>{i + 1}</td>
              <td>
                <span className="ranked-name">{item.label}</span>
                {item.sublabel && (
                  <span className="ranked-sub">{item.sublabel}</span>
                )}
              </td>
              <td>
                {item.value.toLocaleString()}
                {item.percent != null && (
                  <span className="ranked-pct"> ({item.percent.toFixed(1)}%)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
