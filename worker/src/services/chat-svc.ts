import type { Env } from "../config";

export interface RegisteredChat {
    id: string;
    name: string;
}

export async function getRegisteredChats(env: Env): Promise<RegisteredChat[]> {
    try {
        const row = await env.DB.prepare(
            "SELECT value FROM settings WHERE key = 'registered_chats'"
        ).first<{ value: string }>();

        if (row && row.value) {
            return JSON.parse(row.value) as RegisteredChat[];
        }
    } catch (err) {
        console.error("getRegisteredChats failed:", err);
    }
    return [];
}

export async function addRegisteredChat(env: Env, id: string, name: string): Promise<boolean> {
    const chats = await getRegisteredChats(env);
    if (chats.some((c) => c.id === id)) {
        return false; // Already registered
    }

    chats.push({ id, name });

    try {
        await env.DB.prepare(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('registered_chats', ?, datetime('now'))"
        ).bind(JSON.stringify(chats)).run();
        return true;
    } catch (err) {
        console.error("addRegisteredChat failed:", err);
        return false;
    }
}

export async function getTargetTelegramChat(env: Env): Promise<string> {
    try {
        const row = await env.DB.prepare(
            "SELECT value FROM settings WHERE key = 'target_telegram_chat'"
        ).first<{ value: string }>();

        if (row && row.value) {
            return row.value;
        }
    } catch (err) {
        console.error("getTargetTelegramChat failed:", err);
    }
    // Default to env var if setting is completely missing
    return env.TELEGRAM_CHAT_ID || "all";
}
