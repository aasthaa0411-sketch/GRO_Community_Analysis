import { useState } from "react";
import { ConnectionSettings } from "./components/ConnectionSettings";
import { DiscordTab } from "./tabs/DiscordTab";
import { TikTokTab } from "./tabs/TikTokTab";
import { YouTubeTab } from "./tabs/YouTubeTab";

type TabId = "discord" | "youtube" | "tiktok";

const TABS: { id: TabId; label: string }[] = [
  { id: "discord", label: "Discord" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("discord");

  return (
    <div className="app">
      <header className="app-header">
        <h1>GRO Community Analysis</h1>
        <p>Extract and download data from Discord, YouTube, and TikTok.</p>
      </header>

      <ConnectionSettings />

      <nav className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {activeTab === "discord" && <DiscordTab />}
        {activeTab === "youtube" && <YouTubeTab />}
        {activeTab === "tiktok" && <TikTokTab />}
      </main>
    </div>
  );
}
