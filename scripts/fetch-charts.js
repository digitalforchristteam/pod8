// fetch-charts.js
// Pulls Apple Podcasts' official public top-charts (free, no API key) for a set
// of main categories, and keeps a small rolling history so we can show genuine
// day-over-day and week-over-week rank movement — not fabricated numbers.
//
// Honesty note: Apple does not publish raw listener counts publicly, and
// neither does any other free source. Chart RANK is what's actually public,
// so that's what this shows — clearly labeled as rank, not listens.

import fs from 'fs';

const COUNTRY = 'us';
const LIMIT = 15;
const HISTORY_DAYS_KEPT = 8; // enough to compute a 7-day-ago comparison

const CATEGORIES = [
  { id: 1512, name: 'Health & Fitness' },
  { id: 1321, name: 'Business' },
  { id: 1304, name: 'Education' },
  { id: 1324, name: 'Society & Culture' },
  { id: 1303, name: 'Comedy' },
  { id: 1311, name: 'News' },
  { id: 1488, name: 'True Crime' },
  { id: 1318, name: 'Technology' },
  { id: 1545, name: 'Sports' }
];

const CHARTS_OUTPUT = 'docs/data/charts.json';
const HISTORY_PATH = 'docs/data/chart-history.json';
const REQUEST_TIMEOUT_MS = 10000; // prevents one slow category from stalling the run

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchCategoryChart(genreId) {
  const url = `https://itunes.apple.com/${COUNTRY}/rss/toppodcasts/limit=${LIMIT}/genre=${genreId}/json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const entries = json?.feed?.entry;
  if (!entries) return [];

  return entries.map((entry, index) => {
    const images = entry['im:image'] || [];
    const artwork = images.length ? images[images.length - 1].label : null;
    return {
      rank: index + 1,
      id: entry.id?.attributes?.['im:id'] || null,
      name: entry['im:name']?.label || 'Unknown show',
      artist: entry['im:artist']?.label || '',
      artwork,
      url: entry.link?.attributes?.href || null
    };
  });
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

// Updates history with today's ranks and returns rank-change info per show.
function updateHistoryAndComputeDeltas(history, categoryId, shows, date) {
  const catKey = String(categoryId);
  if (!history[catKey]) history[catKey] = {};
  const catHistory = history[catKey];

  const enriched = shows.map(show => {
    if (!show.id) return { ...show, delta1d: null, delta7d: null, isNew: false };

    const past = catHistory[show.id] || [];
    const yesterday = past[past.length - 1];
    const weekAgo = past.length >= 7 ? past[past.length - 7] : past[0];

    const delta1d = yesterday ? yesterday.rank - show.rank : null;
    const delta7d = weekAgo ? weekAgo.rank - show.rank : null;
    const isNew = past.length === 0;

    // append today's snapshot, keep only the most recent N days
    const updated = [...past, { date, rank: show.rank }].slice(-HISTORY_DAYS_KEPT);
    catHistory[show.id] = updated;

    return { ...show, delta1d, delta7d, isNew };
  });

  return enriched;
}

async function main() {
  const history = loadHistory();
  const date = todayISO();
  const categories = [];

  for (const cat of CATEGORIES) {
    console.log(`Fetching Apple Podcasts chart: ${cat.name}`);
    try {
      const shows = await fetchCategoryChart(cat.id);
      const enriched = updateHistoryAndComputeDeltas(history, cat.id, shows, date);
      categories.push({ id: cat.id, name: cat.name, shows: enriched });
    } catch (err) {
      console.error(`  -> Failed to fetch "${cat.name}": ${err.message}`);
      categories.push({ id: cat.id, name: cat.name, shows: [], error: true });
    }
  }

  fs.mkdirSync('docs/data', { recursive: true });
  fs.writeFileSync(
    CHARTS_OUTPUT,
    JSON.stringify({ updatedAt: new Date().toISOString(), categories }, null, 2)
  );
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

  console.log(`\nDone. Saved charts for ${categories.length} categories to ${CHARTS_OUTPUT}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
