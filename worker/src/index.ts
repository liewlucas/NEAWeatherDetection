import type { Env } from "./config";
import { createRouter, json } from "./routes/router";
import { fullCheck } from "./services/rain-detector";
import { saveCapture } from "./services/capture-svc";
import { sendTelegramAlert } from "./services/alert-svc";
import { getStations, postCheck } from "./routes/rainfall";
import { listCaptureDates, listCaptures, getCaptureImage, migrateCaptures } from "./routes/captures";
import { getMonthlySummary } from "./routes/summary";
import { getAlertLog } from "./routes/alerts";
import { getSettings, putSettings, deleteChat } from "./routes/settings";
import { postWebhook } from "./routes/telegram";
import { getTargetTelegramChat, getRegisteredChats } from "./services/chat-svc";
import { fetchForecast } from "./services/nea-client";
import { askGemini } from "./services/gemini-svc";

export type { Env };

const router = createRouter([
  { method: "GET", pattern: "/api/rainfall/stations", handler: getStations },
  { method: "POST", pattern: "/api/rainfall/check", handler: postCheck },
  { method: "GET", pattern: "/api/captures/dates", handler: listCaptureDates },
  { method: "GET", pattern: "/api/captures", handler: listCaptures },
  { method: "GET", pattern: "/api/captures/:id/image", handler: getCaptureImage },
  { method: "POST", pattern: "/api/captures/migrate", handler: migrateCaptures },
  { method: "GET", pattern: "/api/summary/monthly", handler: getMonthlySummary },
  { method: "GET", pattern: "/api/alerts/log", handler: getAlertLog },
  { method: "GET", pattern: "/api/settings", handler: getSettings },
  { method: "PUT", pattern: "/api/settings", handler: putSettings },
  { method: "DELETE", pattern: "/api/settings/chats/:id", handler: deleteChat },
  { method: "POST", pattern: "/api/telegram/webhook", handler: postWebhook },
]);

async function sendForecastSummary(env: Env): Promise<void> {
  if (!env.GEMINI_API_KEY || !env.TELEGRAM_BOT_TOKEN) {
    console.log("Forecast summary skipped: missing GEMINI_API_KEY or TELEGRAM_BOT_TOKEN");
    return;
  }

  const [result, forecast] = await Promise.all([
    fullCheck(env),
    fetchForecast(),
  ]);

  const prompt = "Give a 3-day weather outlook for the Changi area. Mention if rain is expected on any of those days, and note current conditions briefly. Keep it friendly and useful — this is a daily briefing for the group.";
  const summary = await askGemini(env, prompt, result, forecast);

  // Send to all registered chats (or fallback to env CHAT_ID)
  const target = await getTargetTelegramChat(env);
  let chatIds: string[] = [];

  if (target === "none") {
    console.log("Forecast summary: alerts disabled by settings.");
    return;
  } else if (target === "all") {
    const chats = await getRegisteredChats(env);
    chatIds = chats.length > 0
      ? chats.map((c) => c.id)
      : [env.TELEGRAM_CHAT_ID].filter(Boolean) as string[];
  } else {
    chatIds = [target];
  }

  const sendMessage = async (chatId: string) => {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: summary }),
    });
  };

  await Promise.allSettled(chatIds.map(sendMessage));
  console.log(`Forecast summary sent to ${chatIds.length} chat(s)`);
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    // 12-hour forecast cron (7am/7pm SGT)
    if (event.cron === "0 23,11 * * *") {
      try {
        await sendForecastSummary(env);
      } catch (err) {
        console.error("Forecast cron failed:", err);
      }
      return;
    }

    // Default: 5-minute rain check cron
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
