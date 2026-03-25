import { useState, useEffect } from "react";
import { apiFetch } from "../api/client";
import { useApi } from "../hooks/useApi";

interface AlertLog {
  id: number;
  sent_at: string;
  channel: string;
  rainfall_mm: number;
  message: string;
  success: number;
  error: string | null;
}

const EDITABLE_KEYS = [
  { key: "capture_file_pattern", label: "File Naming Pattern" },
  { key: "check_interval_min", label: "Check Interval (min)" },
  { key: "station_radius_km", label: "Station Radius (km)" },
  { key: "alert_cooldown_min", label: "Alert Cooldown (min)" },
];

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const { data: alerts } = useApi<AlertLog[]>("/api/alerts/log?limit=20");

  useEffect(() => {
    apiFetch<Record<string, string>>("/api/settings")
      .then(setSettings)
      .catch(() => setMessage("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const updated = await apiFetch<Record<string, string>>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setMessage("Saved");
    } catch {
      setMessage("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Settings</h2>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : (
        <div className="bg-gray-800 rounded-lg p-4 space-y-4">
          {EDITABLE_KEYS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-400 mb-1">
                {label}
              </label>
              <input
                type="text"
                value={settings[key] || ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, [key]: e.target.value }))
                }
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>
          ))}

          <div key="target_telegram_chat">
            <label className="block text-xs text-gray-400 mb-1 flex items-center justify-between">
              Target Telegram Chat
            </label>
            <select
              value={settings.target_telegram_chat || "all"}
              onChange={(e) =>
                setSettings((s) => ({ ...s, target_telegram_chat: e.target.value }))
              }
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm appearance-none"
            >
              <option value="all">Broadcast to All Groups</option>
              <option value="none">Do Not Send (Silent)</option>
              {(() => {
                let chats: { id: string; name: string }[] = [];
                try {
                  if (settings.registered_chats) {
                    chats = JSON.parse(settings.registered_chats);
                  }
                } catch (e) { }
                return chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ));
              })()}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {message && (
              <span
                className={`text-sm ${message === "Saved" ? "text-green-400" : "text-red-400"
                  }`}
              >
                {message}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          Alert Log
        </h3>
        {!alerts || alerts.length === 0 ? (
          <p className="text-gray-500 text-sm">No alerts sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 pr-4">Sent At</th>
                  <th className="pb-2 pr-4">Rainfall</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className="border-b border-gray-800">
                    <td className="py-2 pr-4">
                      {new Date(a.sent_at).toLocaleString("en-SG", {
                        timeZone: "Asia/Singapore",
                      })}
                    </td>
                    <td className="py-2 pr-4">{a.rainfall_mm} mm</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          a.success
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {a.success ? "OK" : "Failed"}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">
                      {a.error || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
