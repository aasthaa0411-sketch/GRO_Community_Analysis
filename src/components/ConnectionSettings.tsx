import { useState } from "react";
import { DEFAULT_BOT_URL, getApiKey, getBotUrl, setApiKey, setBotUrl } from "../lib/config";

export function ConnectionSettings() {
  const [botUrl, setBotUrlState] = useState(getBotUrl());
  const [apiKey, setApiKeyState] = useState(getApiKey());
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setBotUrl(botUrl.trim() || DEFAULT_BOT_URL);
    setApiKey(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section className="card settings">
      <h2>Connection</h2>
      <p className="hint">
        Export API is live on Render. Paste your <code>EXPORT_API_KEY</code> below
        (same value as on Render — never commit it). Local bot alternative:{" "}
        <code>http://127.0.0.1:3001</code>.
      </p>
      <label>
        Bot URL
        <input
          type="url"
          value={botUrl}
          onChange={(e) => setBotUrlState(e.target.value)}
          placeholder={DEFAULT_BOT_URL}
        />
      </label>
      <label>
        Export API key
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKeyState(e.target.value)}
          placeholder="Bearer token from Render env"
          autoComplete="off"
        />
      </label>
      <button type="button" onClick={handleSave}>
        Save connection
      </button>
      {saved && <span className="success">Saved</span>}
    </section>
  );
}
