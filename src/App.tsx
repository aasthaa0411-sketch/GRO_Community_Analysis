import { useState } from "react";
import { ConnectionSettings } from "./components/ConnectionSettings";
import { getActiveTab, setActiveTab, type TabId } from "./lib/tabPrefs";
import { DiscordTab } from "./tabs/DiscordTab";
import { TikTokTab } from "./tabs/TikTokTab";
import { YouTubeTab } from "./tabs/YouTubeTab";

const TABS: { id: TabId; label: string }[] = [
  { id: "discord", label: "Discord" },
  { id: "youtube", label: "YouTube" },
  { id: "tiktok", label: "TikTok" },
];

export default function App() {
  const [activeTab, setActiveTabState] = useState<TabId>(getActiveTab);

  function selectTab(tab: TabId) {
    setActiveTabState(tab);
    setActiveTab(tab);
  }

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
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        <div className="tab-pane" hidden={activeTab !== "discord"}>
          <DiscordTab />
        </div>
        <div className="tab-pane" hidden={activeTab !== "youtube"}>
          <YouTubeTab />
        </div>
        <div className="tab-pane" hidden={activeTab !== "tiktok"}>
          <TikTokTab />
        </div>
      </main>
    </div>
  );
}
