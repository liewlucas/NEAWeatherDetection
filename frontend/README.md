# antWeather - Frontend

This is the React frontend for the antWeather Live Radar Map dashboard. It's built as a Single Page Application (SPA) designed to be hosted on **Cloudflare Pages**.

## Tech Stack
- **Framework**: React 18 with Vite using TypeScript.
- **Styling**: Tailwind CSS for a modern, responsive interface.
- **Mapping**: `leaflet` and `react-leaflet` for displaying the live radar map, stations, and rain area polygons.
- **Routing**: `react-router-dom` for navigation between Dashboard, History, Captures, and Settings.

## Pages
- **Dashboard**: Live station readings, interactive radar map, and a manual "Check Now" button.
- **History**: Monthly summary with daily breakdown, estimated rain hours, and visual rain bars.
- **Captures**: Date-based folder navigation with drill-down radar image gallery. Click to view full-size captures.
- **Settings**: Configure alert targets (per-group), file naming patterns, station radius, and alert cooldown. Manage registered Telegram groups with add/remove support. View alert log history.

## Development

To run the frontend locally:

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure Environment Variables**:
   By default, the Vite dev server proxy sends API requests to the local worker on port `8787`. If you want to connect to a deployed production worker, create a `.env` file in this directory and set:
   ```env
   VITE_API_URL=https://<your-worker-url>.workers.dev
   ```
3. **Start the Dev Server**:
   ```bash
   npm run dev
   ```

## Production Build & Deployment
The build output is configured to render into the `/dist` folder.

Using GitHub Actions, this project is automatically built and deployed to Cloudflare Pages on every push to the `main` branch.

To deploy manually (e.g., to create a preview deployment):
```bash
npm run build
npx wrangler pages deploy dist --project-name=antweather
```

## UI/UX Features
- **Mobile First**: Uses a hamburger menu and compressed layouts for small screens to prioritize the map view.
- **Collapsible Sidebar**: On desktop, the side navigation can be collapsed into an icon-only mode to save horizontal space.
- **Live Overlays**: Renders a dynamic image overlay representing rain intensity directly on top of the Leaflet map bounds.
- **Date-Based Captures**: Captures page groups radar images by date with folder-style navigation and drill-down.
- **Group Management**: Settings page allows managing registered Telegram groups with per-group removal.
