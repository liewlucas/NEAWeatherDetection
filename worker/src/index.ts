export interface Env {
  DB: D1Database;
  CAPTURES: R2Bucket;
  REGION_CENTER_LAT: string;
  REGION_CENTER_LNG: string;
  REGION_POLYGON: string;
  STATION_RADIUS_KM: string;
  MIN_RAINFALL_MM: string;
  CAPTURE_FILE_PATTERN: string;
  ALERT_COOLDOWN_MIN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RADAR_CLEAR_SIZE_THRESHOLD: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async scheduled(
    _event: ScheduledEvent,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log("Cron triggered — rain check placeholder");
  },

  async fetch(
    request: Request,
    _env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    return json({ status: "ok" });
  },
};
