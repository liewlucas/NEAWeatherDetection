import type { Env } from "../config";
import { parseRegionConfig } from "../config";
import { fetchRainfall } from "../services/nea-client";
import { filterNearbyStations, fullCheck } from "../services/rain-detector";
import { saveCapture } from "../services/capture-svc";
import { sendTelegramStatus } from "../services/alert-svc";
import { json } from "./router";
import { getTargetTelegramChat, getRegisteredChats } from "../services/chat-svc";

export async function getStations(
  _req: Request,
  env: Env
): Promise<Response> {
  const config = parseRegionConfig(env);
  const result = await fetchRainfall();
  const nearby = filterNearbyStations(result.stations, config);
  return json({ stations: nearby, apiTimestamp: result.timestamp });
}

export async function postCheck(
  _req: Request,
  env: Env
): Promise<Response> {
  const result = await fullCheck(env);

  let captureSaved = false;
  let alertSent = false;

  if (result.isRaining && result.radarImage) {
    try {
      const capture = await saveCapture(env, result);
      captureSaved = capture !== null;
    } catch (err) {
      console.error("saveCapture failed:", err);
    }
  }

  // Always send a Telegram status update on manual check target
  try {
    const target = await getTargetTelegramChat(env);
    if (target === "none") {
      console.log("Manual Telegram alerts disabled by settings.");
    } else if (target === "all") {
      const chats = await getRegisteredChats(env);
      const targets = chats.length > 0 ? chats.map((c: any) => c.id) : [env.TELEGRAM_CHAT_ID].filter(Boolean) as string[];
      await Promise.allSettled(targets.map((id: string) => sendTelegramStatus(env, result, id)));
      alertSent = true;
    } else {
      alertSent = await sendTelegramStatus(env, result, target);
    }
  } catch (err) {
    console.error("sendTelegramStatus failed:", err);
  }

  return json({
    isRaining: result.isRaining,
    maxRainfallMm: result.maxRainfallMm,
    nearbyStations: result.nearbyStations,
    rainingStations: result.rainingStations,
    radarTimestamp: result.radarTimestamp,
    apiTimestamp: result.apiTimestamp,
    captureSaved,
    alertSent,
  });
}
