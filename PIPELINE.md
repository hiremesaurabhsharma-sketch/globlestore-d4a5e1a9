# Spark — Full Project Pipeline & Handover

> **Brand:** Spark (`nonispark.com`)  
> **Repo:** `https://github.com/hiremesaurabhsharma-sketch/globlestore-d4a5e1a9`  
> **Stack:** Lovable / TanStack Start v1 + React 19 + Tailwind CSS v4 + Vite + TypeScript  
> **Last pushed:** from Lovable editor via GitHub Data API

---

## 1. What we built

A YouTube-like, ad-free educational video platform focused on **SSC, UPSC, NEET, JEE, State PCS, Banking & Railways**.

### Public pages
- **Home feed (`/`)** — responsive 1/2/3/4-column grid, infinite scroll (24 videos per batch), exam-category chips, smart search, channel/playlist strips, sticky premium header.
- **Watch page (`/watch/:videoId`)** — native YouTube iframe player (theater-style), sticky player on scroll, edge-to-edge on mobile, no zoom, no pop-up modal.
- **Channel page (`/channel/:channelName`)** — Home / Videos / Shorts / Live / Playlists tabs.
- **Playlist page (`/playlist/:channel/:slug`)** — plays all videos in the playlist.
- **Auth page (`/auth`)** — email/password + magic-link only (Google sign-in removed per request). Guest browsing is always allowed.
- **Library pages** (`/library/liked`, `/library/playlists`, `/library/subscriptions`) — gated behind login via `RequireAuth`.
- **Jobs page (`/jobs`)** — kept but not linked in the header anymore.
- **Admin panel (`/admin`)** — add channels, import history, sync, clean blocked videos, prune untracked, backfill durations, push feed to R2.

### Backend / data flow
1. **YouTube Data API** pulls videos from tracked channels.
2. **Supabase** (main project) stores `videos` and `tracked_channels` tables.
3. **Cloudflare R2** receives a static `feed.json` every sync, served on a public CDN (`pub-...r2.dev`). This bypasses Supabase egress costs for high-traffic home feeds.
4. **Frontend cache cascade:** `localStorage` (10 min) → same-origin edge API (`/api/public/feed`) → direct R2 → Supabase fallback.
5. **Realtime refresh** is intentionally delayed (~90 s) so the feed never jumps while a user is scrolling; a full shuffle only happens on a real page refresh.

### Ranking logic
- Hard cut: videos older than 3 years are excluded from the home feed.
- Front slots: up to ~24 fresh videos from the last 3 months, diversified across channels.
- Middle: last 2 years, shuffled.
- Tail: 2–3 years, shuffled.
- Shorts (< 90 s) are heavily deprioritized (only ~5% sample) and rarely shown.
- Search uses `smartSearch` with synonyms, typo tolerance, and teacher-specific scoring.

### Performance & UX
- Lazy-loaded thumbnails, IntersectionObserver infinite scroll, 300 ms debounced search.
- Viewport meta disables mobile zoom (`user-scalable=no`).
- Single active Adsterra banner at a time (320×50).
- Dynamic SEO (`<title>`, `description`, `og:*`, `twitter:*`, JSON-LD, sitemap) per route.

---

## 2. File map you need to know

| Path | Purpose |
| --- | --- |
| `src/routes/index.tsx` | Home feed, header, search, category chips, video grid, playlists |
| `src/routes/watch.$videoId.tsx` | Video player + recommendations |
| `src/routes/channel.$channelName.tsx` | Channel tabs & playlists |
| `src/routes/playlist.$channel.$slug.tsx` | Playlist player |
| `src/routes/admin.tsx` | Admin UI for channel management |
| `src/lib/videos-query.ts` | Feed fetching + ranking/shuffle logic |
| `src/lib/smart-search.ts` | Search ranking |
| `src/lib/youtube-sync.functions.ts` | Add/import/sync channels, cleanup, backfill |
| `src/lib/youtube-api.server.ts` | YouTube Data API helpers |
| `src/lib/r2-sync.functions.ts` | Upload `feed.json` to R2 |
| `src/lib/supabase.ts` | Public Supabase client (main videos DB) |
| `src/lib/supabase-admin.server.ts` | Service-role admin client |
| `src/lib/auth-client.ts` / `auth-context.tsx` | Auth state & Supabase auth client |
| `src/routes/api/public/feed.ts` | Edge feed endpoint (reads R2 or Supabase) |
| `src/routes/api/public/sync-r2.ts` | Cron webhook to push R2 feed |
| `src/routes/api/public/sync-videos.ts` | Cron webhook to sync all channels |
| `SUPABASE_MIGRATION.sql` | SQL to create `tracked_channels` + duration column |
| `src/styles.css` | Tailwind v4 theme + animations |

---

## 3. Secrets & environment variables

Store these in **Lovable Cloud → Secrets** (for Lovable preview/publish) or in your hosting `.env` when running locally / self-hosting.

### Required for the app to run
| Variable | Where to get |
| --- | --- |
| `SUPABASE_URL` | Main videos project: `https://sysxryxguqjjwqdydmkd.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Main videos project publishable key |
| `USERS_SUPABASE_URL` | Auth project: `https://jgycympeypcanifwkxur.supabase.co` |
| `USERS_SUPABASE_PUBLISHABLE_KEY` | Auth project publishable key |
| `USERS_SUPABASE_SERVICE_ROLE_KEY` | Auth project service-role key |
| `YOUTUBE_API_KEY` | Google Cloud → YouTube Data API v3 key |
| `ADMIN_SYNC_TOKEN` | Any strong random string you choose for `/admin` access |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 API token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 API token Secret Access Key |
| `R2_ENDPOINT` | R2 S3 endpoint, e.g. `https://<id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | R2 bucket name |
| `R2_PUBLIC_URL` | Public R2 bucket URL, e.g. `https://pub-<id>.r2.dev` |

### Optional
- `LOVABLE_API_KEY` — for connector gateway (if using Lovable connectors).
- `GITHUB_PERSONAL_ACCESS_TOKEN` — if you ever want CI to push back to GitHub.

---

## 4. How to run locally (Antigravity IDE / VS Code)

### 1. Clone the repo
```bash
git clone https://github.com/hiremesaurabhsharma-sketch/globlestore-d4a5e1a9.git spark
cd spark
```

### 2. Install dependencies
```bash
bun install
# or: npm install
```

### 3. Create `.env` at the project root
Copy all variables from section 3 above.

```bash
SUPABASE_URL=https://sysxryxguqjjwqdydmkd.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
USERS_SUPABASE_URL=https://jgycympeypcanifwkxur.supabase.co
USERS_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
USERS_SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
YOUTUBE_API_KEY=...
ADMIN_SYNC_TOKEN=your_very_secret_token
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://<id>.r2.cloudflarestorage.com
R2_BUCKET=...
R2_PUBLIC_URL=https://pub-<id>.r2.dev
```

> **Important:** Do not commit `.env`. It is already in `.gitignore`.

### 4. Start dev server
```bash
bun run dev
# or: npm run dev
```
Open `http://localhost:8080`.

### 5. Build for production
```bash
bun run build
# or: npm run build
bun run preview
```

---

## 5. How to keep the video feed updated (daily workflow)

### Option A: Manual from the Admin panel
1. Go to `/admin`.
2. Enter your `ADMIN_SYNC_TOKEN`.
3. Click **“Sync all now”** — pulls the latest 50 uploads from each tracked channel and inserts new videos.
4. Click **“Sync to R2”** — uploads the new `feed.json` to Cloudflare R2.
5. Users will see the new videos after ~90 seconds (realtime delay) or immediately on refresh.

### Option B: Automated cron (recommended)
Call the public cron endpoints from any scheduler (e.g., GitHub Actions, cron-job.org, or a Lovable Cloud function).

- **Sync videos:** `POST https://<your-domain>/api/public/sync-videos`  
  Headers: `{ "Authorization": "Bearer <ADMIN_SYNC_TOKEN>" }`
- **Sync R2 feed:** `POST https://<your-domain>/api/public/sync-r2`  
  Headers: `{ "Authorization": "Bearer <ADMIN_SYNC_TOKEN>" }`

You can run both every 30–60 minutes.

### Adding a new channel
1. In `/admin`, paste the channel handle (e.g. `@parmarssc`) or full YouTube URL and click **Add**.
2. Click **Import history** for that channel to backfill old videos.
3. Wait for the import to finish, then click **Sync to R2**.

### Cleaning up
- **Clean blocked videos** — removes videos that are private, deleted, region-blocked, or have embed disabled.
- **Prune untracked** — deletes every video whose channel is not in your tracked list.
- **Backfill durations** — fetches missing YouTube durations so thumbnails get the MM:SS overlay.

---

## 6. How to publish / self-host from GitHub

Because the repo is on GitHub, you can push from any local editor and Lovable will pull automatically **if Git sync is enabled**.

### If you want to host outside Lovable
Any platform that supports Vite + Node.js 20+ works:
1. Push code to GitHub from Antigravity / VS Code.
2. Connect your platform (Vercel, Netlify, Cloudflare Pages, Render, etc.) to the GitHub repo.
3. Add the environment variables from section 3 in the platform dashboard.
4. Build command: `bun run build` (or `npm run build`).
5. Output directory: `dist`.

### If you stay inside Lovable
1. Keep editing in Lovable or locally.
2. Push local changes to GitHub.
3. Lovable auto-syncs them back into the editor.
4. Hit **Publish** in Lovable to deploy.

---

## 7. Cost bypass explanation (why this is “student-proof”)

- **R2 public bucket** = unlimited free reads, so the home feed never hits Supabase egress.
- **R2 + edge API** = feed is served from same-origin cache/Cloudflare, not YouTube.
- **Supabase** is used only for admin writes, auth, and as a fallback — low egress.
- **YouTube Data API** is used only for ingestion (not per user view), so quota is controlled.
- **Auth** is on a separate Supabase project to isolate user growth from the main video DB.

---

## 8. Common gotchas

- **GitHub 404:** The repo was created under the PAT owner account (`hiremesaurabhsharma-sketch`). If you want it under `Gauravaiserviceprovider`, you need to transfer ownership in GitHub repo settings or generate a PAT from that account.
- **Admin token not working:** Make sure `ADMIN_SYNC_TOKEN` is set identically in Lovable Secrets and in your `.env`.
- **No videos showing:** Check that `feed.json` exists in R2 and `R2_PUBLIC_URL` is correct. Also check Supabase `videos` table.
- **Mobile zoom:** Disabled intentionally via viewport meta.
- **Login issues:** Auth uses a separate Supabase project. Verify `USERS_SUPABASE_*` env vars.
- **Realtime feed jump:** The ~90-second delay is intentional; full shuffle only happens on refresh.

---

## 9. Next steps you can do yourself

1. **Buy the domain** (`nonispark.com` / `globlepage.com` / `globletube.in`) and point it to Lovable / your host.
2. **Add ads:** Replace the Adsterra banner slot in `src/components/adsterra-banner-320.tsx` with your own script.
3. **More channels:** Use the `/admin` panel.
4. **Monetization / courses:** Add a paid section later without touching the feed pipeline.
5. **Connect Google Search Console** after setting the canonical domain to track SEO.

---

*If anything breaks, first check the browser console and the Lovable Cloud logs. The project is built to be maintainable by any React/Vite developer without needing Lovable itself.*
