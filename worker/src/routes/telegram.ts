import type { Env } from "../config";
import { fullCheck } from "../services/rain-detector";
import { saveCapture } from "../services/capture-svc";
import { sendTelegramStatus } from "../services/alert-svc";
import { json } from "./router";

import { addRegisteredChat } from "../services/chat-svc";

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
                await addRegisteredChat(env, chatId, chatName);
                console.log(`Registered new user chat: ${chatName} (${chatId})`);
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
        }

        // Always respond 200 OK so Telegram considers the webhook delivered
        return json({ ok: true });
    } catch (err) {
        console.error("Webhook error:", err);
        // Return 200 even on error so Telegram doesn't retry a malformed payload infinitely
        return json({ ok: false, error: "Internal error" }, 200);
    }
}
