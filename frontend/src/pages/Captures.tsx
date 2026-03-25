import { useState } from "react";
import { useApi } from "../hooks/useApi";

interface Capture {
  id: number;
  checked_at: string;
  max_mm: number;
  stations: string;
  radar_key: string;
  radar_bytes: number;
}

interface CapturesResponse {
  total: number;
  captures: Capture[];
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Captures() {
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [viewId, setViewId] = useState<number | null>(null);

  const { data, loading, error } = useApi<CapturesResponse>(
    `/api/captures?limit=${limit}&offset=${offset}`
  );

  const stationCount = (json: string) => {
    try {
      return JSON.parse(json).length;
    } catch {
      return 0;
    }
  };

  const groupByDate = (captures: Capture[]) => {
    const groups: Record<string, Capture[]> = {};
    for (const c of captures) {
      const dateKey = new Date(c.checked_at).toLocaleDateString("en-SG", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(c);
    }
    return Object.entries(groups);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Captures</h2>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {viewId !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 max-w-lg">
            <img
              src={`${API_BASE}/api/captures/${viewId}/image`}
              alt="Radar capture"
              className="w-full rounded"
            />
            <button
              onClick={() => setViewId(null)}
              className="mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          <p className="text-gray-400 text-sm">
            {data.total} total captures
          </p>
          <div className="space-y-6">
            {groupByDate(data.captures).map(([date, captures]) => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-400 mb-3 sticky top-0 bg-gray-900 py-2 z-10">
                  {date} &middot; {captures.length} capture{captures.length !== 1 && "s"}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {captures.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setViewId(c.id)}
                      className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                    >
                      <img
                        src={`${API_BASE}/api/captures/${c.id}/image`}
                        alt={`Capture ${c.id}`}
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                      <div className="p-3 space-y-1">
                        <p className="text-xs text-gray-400">
                          {new Date(c.checked_at).toLocaleString("en-SG", {
                            timeZone: "Asia/Singapore",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-sm">
                          {c.max_mm} mm &middot; {stationCount(c.stations)} stations
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {data.total > offset + limit && (
            <button
              onClick={() => setOffset((o) => o + limit)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Load More
            </button>
          )}
        </>
      )}
    </div>
  );
}
