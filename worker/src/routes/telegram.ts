import type { Env } from "../config";
import { fullCheck } from "../services/rain-detector";
import { saveCapture } from "../services/capture-svc";
import { sendTelegramStatus } from "../services/alert-svc";
import { json } from "./router";

import { addRegisteredChat } from "../services/chat-svc";
import { askGemini } from "../services/gemini-svc";

async function sendTelegramMessage(env: Env, chatId: string, text: string): Promise<void> {
    if (!env.TELEGRAM_BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text }),
        });
    } catch (err) {
        console.error("sendTelegramMessage failed:", err);
    }
}

export async function postWebhook(
    req: Request,
    env: Env
): Promise<Response> {
    try {
        const body: any = await req.json();

        // 1. Detect new group members (bot added to group)
        if (body.message && body.message.new_chat_members) {
            const addedBot = body.message.new_chat_members.some((user: any) => user.is_bot);
            if (addedBot) {
                const chatId = body.message.chat.id.toString();
                const chatName = body.message.chat.title || "Group Chat";
                await addRegisteredChat(env, chatId, chatName);
                console.log(`Registered new group chat: ${chatName} (${chatId})`);
            }
        }

        if (body.message && body.message.text) {
            const text = body.message.text.trim();
            const chatId = body.message.chat.id.toString();
            const chatName = body.message.chat.title || body.message.chat.first_name || "User";

            if (text.startsWith("/start")) {
                const isNew = await addRegisteredChat(env, chatId, chatName);
                const msg = isNew
                    ? `Hey! This chat has been registered for rain alerts. You'll receive notifications when rain is detected near Changi.\n\nCommands:\n/checknow - Run an immediate rain check\n/start - Register this chat`
                    : `This chat is already registered for rain alerts!\n\nCommands:\n/checknow - Run an immediate rain check`;
                await sendTelegramMessage(env, chatId, msg);
                console.log(`${isNew ? "Registered new" : "Already registered"} chat: ${chatName} (${chatId})`);
            }

            if (text.startsWith("/checknow")) {
                console.log("Received /checknow from Telegram webhook");

                // Run the manual check logic
                const result = await fullCheck(env);

                if (result.isRaining && result.radarImage) {
                    try {
                        await saveCapture(env, result);
                    } catch (err) {
                        console.error("Capture failed via webhook:", err);
                    }
                }

                // Reply directly to the telegram user with the status
                await sendTelegramStatus(env, result, chatId);
            }

            // Handle @botusername mentions — weather questions via Gemini
            console.log(`[DEBUG] GEMINI_API_KEY set: ${!!env.GEMINI_API_KEY}, BOT_USERNAME set: ${!!env.TELEGRAM_BOT_USERNAME}, text: "${text}"`);
            if (env.GEMINI_API_KEY && env.TELEGRAM_BOT_USERNAME) {
                const botMention = `@${env.TELEGRAM_BOT_USERNAME.toLowerCase()}`;
                console.log(`[DEBUG] Looking for "${botMention}" in "${text.toLowerCase()}"`);
                if (text.toLowerCase().includes(botMention)) {
                    const userQuery = text.replace(new RegExp(`@${env.TELEGRAM_BOT_USERNAME}`, "gi"), "").trim();
                    console.log(`[DEBUG] userQuery: "${userQuery}"`);
                    if (userQuery) {
                        console.log(`Gemini mention from ${chatName}: "${userQuery}"`);
                        const result = await fullCheck(env);
                        const reply = await askGemini(env, userQuery, result);
                        await sendTelegramMessage(env, chatId, reply);
                    }
                }
            }
        }

        // Always respond 200 OK so Telegram considers the webhook delivered
        return json({ ok: true });
    } catch (err) {
        console.error("Webhook error:", err);
        // Return 200 even on error so Telegram doesn't retry a malformed payload infinitely
        return json({ ok: false, error: "Internal error" }, 200);
    }
}
