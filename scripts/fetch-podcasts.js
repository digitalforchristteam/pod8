// fetch-podcasts.js
// Discovers podcasts by keyword using Apple's free iTunes Search API,
// then reads each show's public RSS feed to grab the latest episodes.
// No API key, no login, no cost.

import fs from 'fs';
import Parser from 'rss-parser';

// --- Customize your niche here ---
const KEYWORDS = [
  'self improvement',
  'productivity',
  'self help',
  'personal development',
  'habits',
  'mindset'
];

const MAX_SHOWS_PER_KEYWORD = 15;   // how many shows to pull per keyword search
const MAX_EPISODES_PER_SHOW = 5;    // how many recent episodes to keep per show
const MAX_TOTAL_EPISODES = 200;     // cap on the final feed size
const OUTPUT_PATH = 'docs/data/episodes.json';

// --- Quality filters ---
const MIN_EPISODE_DURATION_SECONDS = 180; // skip trailers/teasers under 3 minutes
const FILLER_TITLE_PATTERN = /\b(trailer|coming soon|introducing|show intro)\b/i;

// Parses "HH:MM:SS", "MM:SS", or a plain seconds string (all valid itunes:duration formats).
function parseItunesDuration(duration) {
  if (!duration) return null;
  const trimmed = String(duration).trim();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const parts = trimmed.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((total, val) => total * 60 + val, 0);
}

// FEED_TIMEOUT_MS caps how long we'll wait on any single podcast's RSS feed
// before giving up and moving on — without this, one slow/unresponsive feed
// could stall the entire daily run.
const FEED_TIMEOUT_MS = 10000;

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  customFields: {
    item: [
      ['itunes:duration', 'duration'],
      ['itunes:image', 'itunesImage']
    ]
  }
});

async function searchPodcasts(term) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&limit=${MAX_SHOWS_PER_KEYWORD}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
    if (!res.ok) {
      console.error(`iTunes search failed for "${term}": ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`iTunes search timed out or failed for "${term}": ${err.message}`);
    return [];
  }
}

async function fetchFeedEpisodes(feedUrl, showName, showArt) {
  try {
    const feed = await parser.parseURL(feedUrl);
    const filtered = (feed.items || []).filter(item => {
      const title = item.title || '';
      if (FILLER_TITLE_PATTERN.test(title)) return false;
      const seconds = parseItunesDuration(item.duration);
      if (seconds !== null && seconds < MIN_EPISODE_DURATION_SECONDS) return false;
      return true;
    });

    return filtered.slice(0, MAX_EPISODES_PER_SHOW).map(item => ({
      show: showName,
      showArt: showArt || null,
      title: item.title || 'Untitled episode',
      link: item.link || null,
      audioUrl: item.enclosure?.url || null,
      pubDate: item.pubDate || item.isoDate || null,
      description: (item.contentSnippet || item.content || '').slice(0, 300),
      duration: item.duration || null
    }));
  } catch (err) {
    console.error(`Could not read feed for "${showName}" (${feedUrl}): ${err.message}`);
    return [];
  }
}

async function main() {
  const seenFeeds = new Set();
  const allEpisodes = [];

  for (const keyword of KEYWORDS) {
    console.log(`Searching iTunes for: "${keyword}"`);
    const shows = await searchPodcasts(keyword);

    for (const show of shows) {
      const feedUrl = show.feedUrl;
      if (!feedUrl || seenFeeds.has(feedUrl)) continue;
      seenFeeds.add(feedUrl);

      console.log(`  -> Fetching episodes: ${show.collectionName}`);
      const episodes = await fetchFeedEpisodes(
        feedUrl,
        show.collectionName,
        show.artworkUrl600 || show.artworkUrl100
      );
      allEpisodes.push(...episodes);
    }
  }

  // Sort newest first
  allEpisodes.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const trimmed = allEpisodes.slice(0, MAX_TOTAL_EPISODES);

  fs.mkdirSync('docs/data', { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), episodes: trimmed }, null, 2)
  );

  console.log(`\nDone. Saved ${trimmed.length} episodes from ${seenFeeds.size} shows to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
