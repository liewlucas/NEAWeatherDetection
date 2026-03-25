import type { Env } from "./config";
import { createRouter, json } from "./routes/router";
import { fullCheck } from "./services/rain-detector";
import { saveCapture } from "./services/capture-svc";
import { sendTelegramAlert } from "./services/alert-svc";
import { getStations, postCheck } from "./routes/rainfall";
import { listCaptures, getCaptureImage } from "./routes/captures";
import { getMonthlySummary } from "./routes/summary";
import { getAlertLog } from "./routes/alerts";
import { getSettings, putSettings } from "./routes/settings";
import { postWebhook } from "./routes/telegram";
import { getTargetTelegramChat, getRegisteredChats } from "./services/chat-svc";

export type { Env };

const router = createRouter([
  { method: "GET", pattern: "/api/rainfall/stations", handler: getStations },
  { method: "POST", pattern: "/api/rainfall/check", handler: postCheck },
  { method: "GET", pattern: "/api/captures", handler: listCaptures },
  { method: "GET", pattern: "/api/captures/:id/image", handler: getCaptureImage },
  { method: "GET", pattern: "/api/summary/monthly", handler: getMonthlySummary },
  { method: "GET", pattern: "/api/alerts/log", handler: getAlertLog },
  { method: "GET", pattern: "/api/settings", handler: getSettings },
  { method: "PUT", pattern: "/api/settings", handler: putSettings },
  { method: "POST", pattern: "/api/telegram/webhook", handler: postWebhook },
]);

export default {
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    try {
      const result = await fullCheck(env);
      console.log(
        `Rain check: raining=${result.isRaining}, maxMm=${result.maxRainfallMm}, stations=${result.rainingStations.length}`
      );

      if (result.isRaining && result.radarImage) {
        try {
          await saveCapture(env, result);
        } catch (err) {
          console.error("Cron saveCapture failed:", err);
        }

        try {
          const target = await getTargetTelegramChat(env);
          if (target === "none") {
            console.log("Cron alerts disabled by settings.");
          } else if (target === "all") {
            const chats = await getRegisteredChats(env);
            const targets = chats.length > 0 ? chats.map((c: any) => c.id) : [env.TELEGRAM_CHAT_ID].filter(Boolean) as string[];
            await Promise.allSettled(targets.map((id: string) => sendTelegramAlert(env, result, id)));
          } else {
            await sendTelegramAlert(env, result, target);
          }
        } catch (err) {
          console.error("Cron sendTelegramAlert failed:", err);
        }
      }
    } catch (err) {
      console.error("Cron fullCheck failed:", err);
    }
  },

  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    try {
      return await router(request, env);
    } catch (err) {
      console.error("Unhandled fetch error:", err);
      return json(
        { error: err instanceof Error ? err.message : "Internal error" },
        500
      );
    }
  },
};
