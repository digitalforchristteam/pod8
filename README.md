# Self-Growth Pod — Podcast Aggregator

An auto-updating website that discovers self-improvement, personal development, and
productivity podcasts and displays their latest episodes. Runs entirely for free
using GitHub — no API keys, no credit card, no server to manage.

## How it works
- A robot (GitHub Actions) runs once a day
- It searches Apple's free iTunes podcast directory for your chosen keywords
- It reads each matching show's public RSS feed for the newest episodes
- It saves the results to `docs/data/episodes.json`
- Your website (`index.html`) displays that file

## Setup (about 10 minutes)

### 1. Create a free GitHub account
Go to https://github.com/join if you don't already have one. No credit card needed.

### 2. Create a new repository
- Click the **+** icon (top right) → **New repository**
- Name it something like `self-growth-pod`
- Set it to **Public**
- Do NOT initialize with a README (we already have one)
- Click **Create repository**

### 3. Upload these files
- On your new repo's page, click **uploading an existing file**
- Drag in ALL the files and folders from this project, keeping the folder structure exactly
  as-is. The site itself now lives inside a `docs/` folder (`docs/index.html`,
  `docs/videos.html`, `docs/charts.html`, `docs/style.css`, `docs/script*.js`,
  `docs/theme.js`, `docs/data/*.json`) — this is intentional, so keep it nested,
  don't flatten it. Everything else (`scripts/`, `.github/`, `package.json`,
  `wrangler.jsonc`) stays at the top level.
- Commit the files (green button)

> Tip: GitHub's drag-and-drop upload preserves folder structure if you drag the whole
> `podcast-aggregator` folder contents in one go.

### 4. Turn on GitHub Pages (this makes your site public)
- Go to your repo's **Settings** tab → **Pages** (left sidebar)
- Under "Build and deployment", set **Source** to `Deploy from a branch`
- Set **Branch** to `main` and folder to **`/docs`** (not root — the site now lives in that subfolder)
- Click **Save**
- After a minute, your site will be live at:
  `https://YOUR-USERNAME.github.io/self-growth-pod/`

### 5. Run the update robot for the first time
- Go to the **Actions** tab of your repo
- Click **Update Podcast Feed** in the left list
- Click **Run workflow** → **Run workflow** (green button)
- Wait ~1–2 minutes, then refresh — it will commit fresh episode data
- Refresh your live site — episodes should now appear

After this, it updates itself automatically every day at 06:00 UTC. No further action needed.

## Customizing your niche
Open `scripts/fetch-podcasts.js` and edit the `KEYWORDS` list near the top:

```js
const KEYWORDS = [
  'self improvement',
  'productivity',
  'self help',
  'personal development',
  'habits',
  'mindset'
];
```

Add, remove, or change keywords to shift what shows get discovered. Commit the change,
then re-run the workflow (Step 5) to see the new results.

You can also adjust:
- `MAX_SHOWS_PER_KEYWORD` — how many shows to pull per keyword
- `MAX_EPISODES_PER_SHOW` — how many recent episodes per show
- `MAX_TOTAL_EPISODES` — overall cap on the homepage

## Adding YouTube videos

The site also has a `videos.html` page that auto-discovers YouTube videos by keyword,
using Google's free YouTube Data API. This needs one extra one-time step: getting a
free API key and adding it as a **secret** (never put it directly in your code).

### 1. Get a free YouTube Data API key
- Go to https://console.cloud.google.com/ and sign in with any Google account
- Create a new project (top left project dropdown → "New Project")
- In the search bar, search for **"YouTube Data API v3"** and click **Enable**
- Go to **APIs & Services → Credentials → Create Credentials → API key**
- Copy the key that appears

No credit card is required for this — the free daily quota (10,000 units) doesn't
require a billing account to be enabled.

### 2. Add the key as a GitHub secret
- In your repo, go to **Settings → Secrets and variables → Actions**
- Click **New repository secret**
- Name: `YOUTUBE_API_KEY`
- Value: paste the key you copied
- Click **Add secret**

This keeps your key private — it's never visible in your code or commits.

### 3. Run the update
- Go to the **Actions** tab → **Update YouTube Feed** → **Run workflow**
- Wait ~1 minute, then visit `videos.html` on your live site

It will now also refresh automatically once a day, alongside the podcast update.

### Customizing YouTube keywords
Same idea as podcasts — edit the `KEYWORDS` list near the top of `scripts/fetch-youtube.js`.

## Quality filtering

Raw keyword search on both platforms turns up a mix of great content and noise
(Shorts, trailers, clickbait, spammy tiny channels). Both fetch scripts filter
before publishing, using tunable constants near the top of each file:

**`scripts/fetch-youtube.js`**
- `MIN_VIDEO_DURATION_SECONDS` (default 90) — drops YouTube Shorts/clips
- `MIN_CHANNEL_SUBSCRIBERS` (default 1000) — drops very small/spammy channels
  (channels that hide their subscriber count are not penalized, since that's a
  legitimate privacy choice, not a quality signal)
- `EXCLUDE_LIVE_AND_UPCOMING` (default true) — drops live streams and premieres
- `CLICKBAIT_FLAG_THRESHOLD` (default 2) — a title needs 2+ red flags (phrases
  like "you won't believe", excessive "!!", ALL-CAPS shouting, emoji spam) before
  it's dropped, so a single borderline signal won't unfairly exclude a video

The console log after each run shows how many videos were dropped and why —
useful for tuning the thresholds to your taste.

**`scripts/fetch-podcasts.js`**
- `MIN_EPISODE_DURATION_SECONDS` (default 180) — skips short trailer/teaser clips
- `FILLER_TITLE_PATTERN` — skips episodes titled things like "Trailer" or "Coming Soon"

If your niche genuinely has valuable short-form content (e.g. quick-tip Shorts),
just lower or remove the relevant filter.

## Trending Charts (new)

The site now has a third tab, **Charts**, at `charts.html`, showing:

1. **Top Podcasts by Category** — real Apple Podcasts chart rankings (Health &
   Fitness, Business, Education, Society & Culture, Comedy, News, True Crime,
   Technology, Sports), refreshed daily. Because the update runs daily and keeps
   a small history file, each show gets a genuine **▲/▼ rank-change badge**
   comparing today to yesterday, and a **✨ NEW** badge the first time a show
   enters the tracked chart.
2. **Trending YouTube Videos** — the videos already being tracked, re-sorted by
   real current view count.
3. **Top Channels** — the channels already being tracked, ranked by real
   subscriber count.

### Being upfront about what this data is
Apple and YouTube don't publish raw "active listener" numbers publicly, and no
free source does either — that data is proprietary to each platform. What's
public and free is:
- Apple's daily **chart rank** per category (used here, with real day-over-day
  movement calculated from our own snapshots — not fabricated)
- YouTube's real **view counts** and **subscriber counts** (used here directly)

This is why the Charts page is framed around rank movement and real view/sub
counts rather than invented "active listener" figures.

### Setting it up
Same pattern as the others — no new account or key needed, since Apple's chart
data is fully public:
- Go to **Actions → Update Podcast Charts → Run workflow** once to populate
  `docs/data/charts.json`
- It also updates automatically once a day afterward
- The rank-movement badges will start appearing meaningfully after the second
  run (the first run has nothing to compare against yet)

### Customizing categories
Edit the `CATEGORIES` list in `scripts/fetch-charts.js` — each entry needs an
Apple genre `id` and a display `name`. A few more IDs if you want to add categories:
Arts (1301), Kids & Family (1305), Religion & Spirituality (1314), TV & Film (1309).

## Design

The site uses a playful, rainbow-accented look (Fredoka for headings, Nunito for
body text), an animated soft-blurred blob background, and gentle motion —
cards fade/slide in with a staggered delay, hover states lift and tilt slightly,
and the header title has a slow-moving rainbow shimmer. All motion respects
`prefers-reduced-motion` and turns off automatically for anyone with that
system setting enabled.

To adjust the palette, edit the CSS variables near the top of `style.css`
(`--coral`, `--sun`, `--mint`, `--sky`, `--grape`, `--tangerine`, `--pink`, and
`--accent`). To tone down motion, remove or shorten the `animation` properties
on `.blob`, `.card`, and `header h1` in the same file.

## Deploying to Cloudflare (instead of, or alongside, GitHub Pages)

Cloudflare's dashboard now defaults new projects to "Workers with static assets"
rather than the classic separate "Pages" product. That's fine — this repo is now
set up to deploy correctly either way, because of two committed files:

- **`wrangler.jsonc`** at the repo root tells Cloudflare exactly where the
  website lives (`docs/`) — so when it runs `npm install` and creates a
  `node_modules` folder at the repo root during the build, that folder is a
  *sibling* of `docs/`, never inside it, and can never get swept into the
  deployed site. This is what was causing every previous "Asset too large"
  failure — `node_modules` living in the same folder being scanned.
- **`docs/.assetsignore`** is a small extra backstop excluding one internal
  bookkeeping file from being served.

### If you already have a broken project (e.g. "pod7")
You don't need to delete and recreate it. Once this restructured code is pushed:
1. Go to that project in the Cloudflare dashboard → **Deployments**
2. Click **Retry build** (or just push any small change to trigger a fresh one)
3. It should now succeed, since `wrangler.jsonc` now tells it precisely where
   the site is

If it fails with a "name mismatch" error instead, open `wrangler.jsonc` and
change `"name": "self-growth-pod"` to match your Cloudflare project's exact
name (e.g. `"pod7"`), then push again.

### Setting up a brand new Cloudflare project
Same either way now — Workers or Pages will both work correctly:
1. Cloudflare dashboard → **Workers & Pages** → **Create application**
2. Connect to your GitHub repo
3. Leave build settings as detected/default — no manual output-directory
   changes are needed anymore, since `wrangler.jsonc` handles that
4. **Save and Deploy**

## Costs
- GitHub account: free
- GitHub Pages hosting: free
- GitHub Actions (the daily robot): free for public repositories
- iTunes Search API: free, no key required
- Podcast RSS feeds: free, publicly published by each show

No credit card is required anywhere in this setup.
