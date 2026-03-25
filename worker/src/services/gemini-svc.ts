import type { Env } from "../config";
import type { CheckResult } from "./rain-detector";
import type { ForecastData } from "./nea-client";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

const SYSTEM_PROMPT = `You are a friendly weather bot in a Telegram group chat, mainly monitoring rain near Changi, Singapore using live NEA data.

Personality: casual, witty, and helpful. You're chatting with friends, not writing a report. Use short replies. Emojis are fine.

Weather questions: answer using the live data provided. You have both real-time rainfall readings AND forecast data (2-hour, 24-hour, and 4-day). Use the forecasts to answer prediction questions like "will it rain tomorrow?" Mention station names and readings when relevant. You know most about the Changi area (that's where your sensors are), but you can give general advice about Singapore weather too — just note when you're speaking generally vs from your live data.

Non-weather chat: you can engage briefly — crack a joke, respond to banter, be human. But you naturally gravitate back to weather since that's your thing. Don't lecture people about staying on topic.

Keep replies under 150 words. This is Telegram, not an essay.`;

function buildWeatherContext(result: CheckResult, forecast?: ForecastData | null): string {
    const lines: string[] = [];
    lines.push(`Current time (SGT): ${new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" })}`);
    lines.push(`\n--- LIVE RAINFALL DATA ---`);
    lines.push(`Rain detected: ${result.isRaining ? "Yes" : "No"}`);
    lines.push(`Max rainfall: ${result.maxRainfallMm}mm`);
    lines.push(`Nearby stations checked: ${result.nearbyStations.length}`);

    if (result.rainingStations.length > 0) {
        lines.push(`Stations reporting rain:`);
        for (const s of result.rainingStations) {
            lines.push(`  - ${s.name}: ${s.rainfallMm}mm (${s.distanceKm.toFixed(1)}km away)`);
        }
    } else {
        lines.push(`No stations reporting rainfall.`);
    }

    if (result.radarImage) {
        const sizeKb = (result.radarImage.byteLength / 1024).toFixed(1);
        lines.push(`Radar image size: ${sizeKb}KB (larger = more precipitation visible)`);
    }

    if (forecast) {
        lines.push(`\n--- FORECAST DATA ---`);

        if (forecast.twoHour) {
            lines.push(`2-hour forecast for Changi: ${forecast.twoHour.forecast}`);
        }

        if (forecast.twentyFourHour) {
            lines.push(`24-hour general: ${forecast.twentyFourHour.general}`);
            for (const p of forecast.twentyFourHour.periods) {
                lines.push(`  East region (${p.start} to ${p.end}): ${p.east}`);
            }
        }

        if (forecast.fourDay.length > 0) {
            lines.push(`4-day outlook:`);
            for (const d of forecast.fourDay) {
                lines.push(`  ${d.date}: ${d.forecast} (${d.temperature.low}-${d.temperature.high}°C, humidity ${d.humidity.low}-${d.humidity.high}%, wind ${d.wind.direction} ${d.wind.speed.low}-${d.wind.speed.high}km/h)`);
            }
        }
    }

    return lines.join("\n");
}

export async function askGemini(
    env: Env,
    userMessage: string,
    weatherData: CheckResult,
    forecast?: ForecastData | null
): Promise<string> {
    if (!env.GEMINI_API_KEY) {
        return "Gemini API key not configured.";
    }

    const context = buildWeatherContext(weatherData, forecast);

    const body = {
        system_instruction: {
            parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
            {
                role: "user",
                parts: [
                    { text: `Live weather data:\n${context}\n\nUser question: ${userMessage}` },
                ],
            },
        ],
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
        },
    };

    try {
        const res = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            console.error("Gemini API error:", res.status, await res.text());
            return "Sorry, I couldn't process that right now. Try again later.";
        }

        const data: any = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            return "Sorry, I didn't get a response. Try again.";
        }

        // Telegram has a 4096 char limit
        return text.length > 4000 ? text.slice(0, 4000) + "..." : text;
    } catch (err) {
        console.error("Gemini fetch failed:", err);
        return "Sorry, something went wrong. Try again later.";
    }
}
