export function YouTubeTab() {
  return (
    <div className="tab-panel">
      <header className="tab-header">
        <h2>YouTube export</h2>
        <p>Coming next: video picker, comments, replies, and analytics export.</p>
      </header>
      <ul className="planned-list">
        <li>Comments and replies per video</li>
        <li>Video metadata (title, views, likes)</li>
        <li>Analytics (watch time, retention, CTR, revenue, subscribers)</li>
        <li>JSON and CSV download</li>
      </ul>
    </div>
  );
}
