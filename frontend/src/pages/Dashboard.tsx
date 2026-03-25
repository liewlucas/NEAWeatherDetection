import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api/client";
import StatusBadge from "../components/StatusBadge";
import StationTable from "../components/StationTable";
import RadarMap from "../components/RadarMap";

interface Station {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  rainfallMm: number;
  distanceKm: number;
  inPolygon: boolean;
}

interface StationsResponse {
  stations: Station[];
  apiTimestamp: string;
  checkedAt: string;
}

interface CheckResponse {
  isRaining: boolean;
  maxRainfallMm: number;
  nearbyStations: Station[];
  rainingStations: Station[];
  radarTimestamp: string | null;
  apiTimestamp: string;
  captureSaved: boolean;
  alertSent: boolean;
}

export default function Dashboard() {
  const [stations, setStations] = useState<Station[]>([]);
  const [timestamp, setTimestamp] = useState("");
  const [apiTimestamp, setApiTimestamp] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResponse | null>(null);

  const fetchStations = useCallback(() => {
    setLoading(true);
    apiFetch<StationsResponse>("/api/rainfall/stations")
      .then((data) => {
        setStations(data.stations);
        setTimestamp(data.checkedAt);
        setApiTimestamp(data.apiTimestamp);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStations();
    const interval = setInterval(fetchStations, 60000);
    return () => clearInterval(interval);
  }, [fetchStations]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await apiFetch<CheckResponse>("/api/rainfall/check", {
        method: "POST",
      });
      setCheckResult(result);
      setStations(result.nearbyStations);
      setTimestamp(new Date().toISOString());
      setApiTimestamp(result.apiTimestamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setChecking(false);
    }
  };

  const isRaining = checkResult?.isRaining ?? stations.some((s) => s.rainfallMm > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm font-medium transition-colors"
        >
          {checking ? "Checking..." : "Check Now"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Status</p>
          {loading ? (
            <StatusBadge status="loading" />
          ) : error ? (
            <StatusBadge status="error" />
          ) : isRaining ? (
            <StatusBadge status="rain" />
          ) : (
            <StatusBadge status="dry" />
          )}
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Last Check</p>
          <p className="text-sm">
            {timestamp
              ? new Date(timestamp).toLocaleString("en-SG", {
                timeZone: "Asia/Singapore",
              })
              : "-"}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">NEA Data</p>
          <p className="text-sm">
            {apiTimestamp
              ? new Date(apiTimestamp).toLocaleString("en-SG", {
                timeZone: "Asia/Singapore",
              })
              : "-"}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Max Rainfall</p>
          <p className="text-sm">
            {checkResult ? `${checkResult.maxRainfallMm} mm` : "-"}
          </p>
        </div>
      </div>

      {checkResult && (
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">
            Capture saved: {checkResult.captureSaved ? "Yes" : "No"} | Alert
            sent: {checkResult.alertSent ? "Yes" : "No"}
          </p>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Live Radar</h3>
        <RadarMap stations={stations} />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          Nearby Stations ({stations.length})
        </h3>
        <StationTable stations={stations} />
      </div>
    </div>
  );
}
