# 🐜🌦️antWeather (NEA Rain Monitor)

A full-stack, live weather radar application built to monitor rainfall in Singapore using the NEA (National Environment Agency) API. The application provides a responsive web dashboard to view live radar maps, an AI-powered Telegram bot for conversational weather queries, and automatically sends alerts, radar snapshots, and forecast briefings to registered Telegram groups when rain is detected in your specified region.

## Architecture Highlights
- **Frontend** (`/frontend`): A mobile-first React SPA built with Vite, Tailwind CSS, and Leaflet for dynamic mapping. Hosted on **Cloudflare Pages**.
- **Backend API** (`/worker`): A serverless backend built on **Cloudflare Workers** using TypeScript. It runs cron schedules, serves API requests, and handles Telegram webhooks.
- **Database**: Cloudflare **D1** (Serverless SQLite) is used to track historical rain captures, alerts, and settings.
- **Storage**: Cloudflare **R2** Object Storage is used to save radar images organized in date-based folders (`year/month/day/`).
- **AI**: Google **Gemini 2.0 Flash Lite** powers conversational weather queries and automated forecast summaries via NEA forecast data (2-hour, 24-hour, 4-day).
- **CI/CD**: Fully automated deployments using **GitHub Actions**. Pushing to the `main` branch automatically deploys updates to both Cloudflare Pages and Workers.

## Key Features
- **Live Radar Map**: View real-time rainfall data overlaid on an interactive map.
- **Telegram Alerting**: Automated alerts sent to registered Telegram groups containing radar snapshots when rain is detected (with configurable cooldown).
- **Instant Webhooks**: Send `/checknow` in Telegram to instantly trigger a weather check and get a reply.
- **AI Weather Bot**: Mention `@antWeather_Bot` or reply to any bot message to ask weather questions — powered by Gemini with live station data and NEA forecasts.
- **Forecast Briefings**: Automated 3-day weather outlook sent to all registered groups at 7am and 7pm SGT.
- **Multi-Group Support**: Bot can be added to multiple Telegram groups, each auto-registering via `/start` with per-group management from the dashboard.
- **Date-Based Captures**: Radar images organized into date folders with drill-down gallery navigation.
- **Mobile Responsive**: Collapsible desktop sidebar and compact mobile-friendly bottom navigation.

## Repository Structure
- `/frontend`: The React UI application (Dashboard, History, Captures, Settings). See [Frontend README](./frontend/README.md) for local development instructions.
- `/worker`: The Cloudflare Worker API, cron jobs, Telegram webhook handler, and database schemas. See [Worker README](./worker/README.md) for deployment and database setup instructions.
- `.github/workflows`: Contains the `deploy.yml` pipeline that auto-deploys via Cloudflare's official GitHub Actions.

## Setup Prerequisites
To run or deploy this project, you need:
1. A **Cloudflare Account** (for Pages, Workers, D1, and R2).
2. A **Telegram Bot Token** and Chat ID (for receiving alerts).
3. A **Gemini API Key** (for AI weather bot and forecast features).
4. The **Wrangler CLI** (`npm install -g wrangler`) installed locally.
