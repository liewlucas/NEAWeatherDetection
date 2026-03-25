import type { Env } from "../config";
import type { CheckResult } from "./rain-detector";

export async function checkCooldown(
  db: D1Database,
  cooldownMin: number
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT sent_at FROM alert_logs WHERE channel = 'telegram' AND success = 1 ORDER BY sent_at DESC LIMIT 1"
    )
    .first<{ sent_at: string }>();

  if (!row) return true;

  const elapsed =
    (Date.now() - new Date(row.sent_at).getTime()) / 1000 / 60;
  return elapsed >= cooldownMin;
}

export async function sendTelegramAlert(
  env: Env,
  result: CheckResult,
  chatId: string
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;

  const cooldownMin = parseInt(env.ALERT_COOLDOWN_MIN) || 30;
  const canSend = await checkCooldown(env.DB, cooldownMin);
  if (!canSend) return false;

  const stationLines = result.rainingStations
    .map(
      (s) =>
        `  • ${s.name}: ${s.rainfallMm}mm (${s.distanceKm.toFixed(1)}km away)`
    )
    .join("\n");

  const sgt = new Date().toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
  });

  const message = [
    "🌧️ *Rain Detected*",
    "",
    `Max rainfall: ${result.maxRainfallMm}mm`,
    "Stations reporting rain:",
    stationLines || "  (radar-only detection)",
    "",
    sgt,
  ].join("\n");

  let success = true;
  let error: string | undefined;

  try {
    const apiBase = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
    let res: Response;

    if (result.radarImage) {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", message);
      form.append("parse_mode", "Markdown");
      form.append(
        "photo",
        new Blob([result.radarImage], { type: "image/png" }),
        "radar.png"
      );
      res = await fetch(`${apiBase}/sendPhoto`, {
        method: "POST",
        body: form,
      });
    } else {
      res = await fetch(`${apiBase}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
    }

    if (!res.ok) {
      success = false;
      error = `Telegram HTTP ${res.status}`;
    }
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO alert_logs (sent_at, channel, rainfall_mm, message, success, error)
       VALUES (?, 'telegram', ?, ?, ?, ?)`
    )
      .bind(
        new Date().toISOString(),
        result.maxRainfallMm,
        message,
        success ? 1 : 0,
        error ?? null
      )
      .run();
  } catch (err) {
    console.error("Failed to log alert:", err);
  }

  return success;
}

/** Always sends a status update — used by manual "Check Now" button. No cooldown. */
export async function sendTelegramStatus(
  env: Env,
  result: CheckResult,
  chatId: string
): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return false;

  const sgt = new Date().toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
  });

  let message: string;

  if (result.isRaining) {
    const stationLines = result.rainingStations
      .map(
        (s) =>
          `  • ${s.name}: ${s.rainfallMm}mm (${s.distanceKm.toFixed(1)}km away)`
      )
      .join("\n");

    message = [
      "🌧️ *Rain Detected*",
      "",
      `Max rainfall: ${result.maxRainfallMm}mm`,
      "Stations reporting rain:",
      stationLines || "  (radar-only detection)",
      "",
      sgt,
    ].join("\n");
  } else {
    const stationLines = result.nearbyStations
      .map(
        (s) => `  • ${s.name}: ${s.rainfallMm}mm`
      )
      .join("\n");

    message = [
      "☀️ *Weather Check (Site) — No Rain*",
      "",
      `Nearby stations (${result.nearbyStations.length}):`,
      stationLines || "  (no stations found)",
      "",
      sgt,
    ].join("\n");
  }

  try {
    const apiBase = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
    console.log("Sending Telegram status to chat:", chatId);

    let res: Response;

    if (result.radarImage) {
      // Send radar image with caption
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", message);
      form.append("parse_mode", "Markdown");
      form.append(
        "photo",
        new Blob([result.radarImage], { type: "image/png" }),
        "radar.png"
      );
      res = await fetch(`${apiBase}/sendPhoto`, {
        method: "POST",
        body: form,
      });
    } else {
      // No radar image — send text only
      res = await fetch(`${apiBase}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
    }

    const body = await res.text();
    console.log(`Telegram response: ${res.status} ${body}`);
    return res.ok;
  } catch (err) {
    console.error("sendTelegramStatus failed:", err);
    return false;
  }
}
