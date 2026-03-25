# antWeather - Cloudflare Worker Backend

This directory contains the serverless backend code for the antWeather application, built with TypeScript and designed specifically for **Cloudflare Workers**.

## Tech Stack & Required Bindings
This worker heavily relies on Cloudflare's ecosystem:
- **Workers**: Code execution (cron jobs + API serving).
- **D1 Database**: A serverless SQLite database bound to the worker for storing captures, logs, and settings.
- **R2 Storage**: Object storage bound to the worker for saving the `.png` radar image captures in date-based folders (`year/month/day/`).

## Features
- **Cron Jobs**: Two scheduled triggers:
  - `*/5 * * * *` — Rain detection every 5 minutes using NEA rainfall API + radar imagery.
  - `0 23,11 * * *` — 3-day forecast briefing at 7am/7pm SGT, sent to all registered Telegram groups.
- **REST API**: Provides endpoints (`/api/*`) for the React frontend, including historical captures, settings, monthly summaries, and manual rain checks.
- **Telegram Webhook**: Exposes `/api/telegram/webhook` to handle:
  - `/start` — Register a group for alerts
  - `/checknow` — Trigger an instant rain check
  - `@botname` mentions — AI weather queries via Gemini
  - Replies to bot messages — Continue conversations without needing `@`
- **AI Integration**: Gemini 2.0 Flash Lite for conversational weather queries and forecast summaries, fed with live station data and NEA forecasts (2-hour, 24-hour, 4-day).
- **Image Processing**: Overlays the raw radar imagery with a map before saving to R2 and sending to Telegram.
- **Multi-Group Support**: Manages multiple registered Telegram groups with per-group alert targeting.

## Environment Setup
You need the following variables and secrets configured in a `.dev.vars` file (for local development) or securely uploaded to Cloudflare via `wrangler secret put <NAME>` (for production).

### Secrets
- `TELEGRAM_BOT_TOKEN`: The bot token obtained from BotFather (e.g., `1234567890:AAH8Ymmy9T8Bb...`).
- `TELEGRAM_CHAT_ID`: The ID of the user or group chat where alerts should be sent (e.g., `-5265318501`).
- `GEMINI_API_KEY`: Google Gemini API key for AI weather bot features.

### Environment Config Variables (via `wrangler.toml`)
- `REGION_CENTER_LAT`, `REGION_CENTER_LNG`: Center point of the monitored region.
- `REGION_POLYGON`: A semicolon-separated string of lat/lng coordinate pairs defining the exact boundaries of the monitored area.
- `TELEGRAM_BOT_USERNAME`: The bot's Telegram username (for mention detection).

## Local Development
To develop and test the worker locally:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize Local D1 Database**:
   Apply your database schema to the local wrangler environment:
   ```bash
   npx wrangler d1 execute neaweather --local --file=./schema.sql
   ```

3. **Start the Dev Server**:
   ```bash
   npx wrangler dev
   ```
   This will start a local emulation of the worker, usually on `http://127.0.0.1:8787`.

4. **Test cron manually**:
   ```bash
   curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
   ```

## Deployment
This worker is automatically deployed using **GitHub Actions** on pushes to the `main` branch.

To deploy manually via CLI:
```bash
npx wrangler deploy
```

> **Note**: Don't forget to configure the D1 and R2 bindings in your `wrangler.toml` file to point to your specific Cloudflare IDs before deploying for the first time.
