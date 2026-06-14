export function TikTokTab() {
  return (
    <div className="tab-panel">
      <header className="tab-header">
        <h2>TikTok export</h2>
        <p>Coming next: same workflow as YouTube for your connected TikTok account.</p>
      </header>
      <ul className="planned-list">
        <li>Video picker from your channel</li>
        <li>Comments and metadata (views, likes, shares)</li>
        <li>JSON and CSV download</li>
      </ul>
      <p className="hint">
        Deep analytics (watch time, retention, revenue) depend on TikTok API
        access and may be limited compared to YouTube.
      </p>
    </div>
  );
}
