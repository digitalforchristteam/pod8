// fetch-youtube.js
// Discovers recent YouTube videos matching self-improvement/productivity keywords
// using the free YouTube Data API v3, then filters out Shorts, live streams,
// tiny/spammy channels, and clickbait-y titles before publishing.
// Requires a free API key stored as the YOUTUBE_API_KEY secret — never hardcode it.

import fs from 'fs';

const KEYWORDS = [
  'self improvement',
  'productivity tips',
  'personal development',
  'habit building',
  'goal setting',
  'mindset'
];

const MAX_RESULTS_PER_KEYWORD = 10;
const MAX_TOTAL_VIDEOS = 150;
const OUTPUT_PATH = 'docs/data/videos.json';

// Caps how long we'll wait on any single API request before giving up and
// moving on — prevents one slow response from stalling the whole daily run.
const REQUEST_TIMEOUT_MS = 10000;

// --- Quality filters (tune these to taste) ---
const MIN_VIDEO_DURATION_SECONDS = 90;   // filters out YouTube Shorts / clips
const MIN_CHANNEL_SUBSCRIBERS = 1000;    // filters out very low-effort/spam channels
const CLICKBAIT_FLAG_THRESHOLD = 2;      // title needs 2+ red flags to get dropped
const EXCLUDE_LIVE_AND_UPCOMING = true;

const CLICKBAIT_PATTERNS = [
  /\b(shocking|you won'?t believe|gone wrong|gone sexual|insane|unbelievable)\b/i,
  /\b(must watch|number \d+ will|this changed my life forever)\b/i,
  /!{2,}/,                 // "!!" or more
  /\?{2,}/,                // "??" or more
  /\p{Emoji_Presentation}{3,}/u  // 3+ emoji jammed in a title
];

const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY environment variable. See README for setup.');
  process.exit(1);
}

function publishedAfterISO(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

// Parses YouTube's ISO 8601 duration format (e.g. "PT4M13S") into seconds.
function parseISO8601Duration(duration) {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (parseInt(h || 0, 10) * 3600) + (parseInt(m || 0, 10) * 60) + parseInt(s || 0, 10);
}

function isAllCapsShouty(title) {
  const letters = title.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 12) return false; // too short to judge fairly
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.7;
}

function clickbaitFlagCount(title) {
  let flags = CLICKBAIT_PATTERNS.filter(p => p.test(title)).length;
  if (isAllCapsShouty(title)) flags += 1;
  return flags;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function searchVideos(keyword) {
  const params = new URLSearchParams({
    part: 'snippet',
    q: keyword,
    type: 'video',
    order: 'date',
    maxResults: String(MAX_RESULTS_PER_KEYWORD),
    publishedAfter: publishedAfterISO(14),
    key: API_KEY
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    if (!res.ok) {
      console.error(`YouTube search failed for "${keyword}": ${res.status} ${await res.text()}`);
      return [];
    }

    const data = await res.json();
    return (data.items || []).map(item => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      publishedAt: item.snippet.publishedAt,
      description: (item.snippet.description || '').slice(0, 300),
      thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url || null,
      liveBroadcastContent: item.snippet.liveBroadcastContent || 'none'
    }));
  } catch (err) {
    console.error(`YouTube search timed out or failed for "${keyword}": ${err.message}`);
    return [];
  }
}

// Batched lookup of duration + view count for a list of video IDs.
async function fetchVideoDetails(videoIds) {
  const details = new Map();
  for (const batch of chunk(videoIds, 50)) {
    const params = new URLSearchParams({
      part: 'contentDetails,statistics',
      id: batch.join(','),
      key: API_KEY
    });
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!res.ok) {
        console.error(`videos.list failed: ${res.status} ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        details.set(item.id, {
          durationSeconds: parseISO8601Duration(item.contentDetails?.duration),
          viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null
        });
      }
    } catch (err) {
      console.error(`videos.list timed out or failed: ${err.message}`);
    }
  }
  return details;
}

// Batched lookup of subscriber counts for a list of channel IDs.
async function fetchChannelDetails(channelIds) {
  const details = new Map();
  for (const batch of chunk(channelIds, 50)) {
    const params = new URLSearchParams({
      part: 'statistics',
      id: batch.join(','),
      key: API_KEY
    });
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params.toString()}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      if (!res.ok) {
        console.error(`channels.list failed: ${res.status} ${await res.text()}`);
        continue;
      }
      const data = await res.json();
      for (const item of data.items || []) {
        details.set(item.id, {
          subscriberCount: item.statistics?.hiddenSubscriberCount
            ? null // channel chose to hide its count — don't penalize for unknown
            : Number(item.statistics?.subscriberCount || 0)
        });
      }
    } catch (err) {
      console.error(`channels.list timed out or failed: ${err.message}`);
    }
  }
  return details;
}

function formatCount(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function main() {
  const seen = new Set();
  const candidates = [];

  for (const keyword of KEYWORDS) {
    console.log(`Searching YouTube for: "${keyword}"`);
    const videos = await searchVideos(keyword);
    for (const v of videos) {
      if (seen.has(v.videoId)) continue;
      seen.add(v.videoId);
      candidates.push(v);
    }
  }

  console.log(`Found ${candidates.length} unique candidates, fetching quality signals...`);

  const videoDetails = await fetchVideoDetails(candidates.map(c => c.videoId));
  const channelDetails = await fetchChannelDetails([...new Set(candidates.map(c => c.channelId))]);

  const kept = [];
  const dropped = { live: 0, short: 0, smallChannel: 0, clickbait: 0 };

  for (const v of candidates) {
    if (EXCLUDE_LIVE_AND_UPCOMING && v.liveBroadcastContent !== 'none') {
      dropped.live++;
      continue;
    }

    const vd = videoDetails.get(v.videoId) || {};
    if (vd.durationSeconds !== null && vd.durationSeconds !== undefined && vd.durationSeconds < MIN_VIDEO_DURATION_SECONDS) {
      dropped.short++;
      continue;
    }

    const cd = channelDetails.get(v.channelId) || {};
    if (cd.subscriberCount !== null && cd.subscriberCount !== undefined && cd.subscriberCount < MIN_CHANNEL_SUBSCRIBERS) {
      dropped.smallChannel++;
      continue;
    }

    if (clickbaitFlagCount(v.title) >= CLICKBAIT_FLAG_THRESHOLD) {
      dropped.clickbait++;
      continue;
    }

    kept.push({
      ...v,
      durationSeconds: vd.durationSeconds ?? null,
      viewCount: vd.viewCount ?? null,
      viewCountDisplay: formatCount(vd.viewCount),
      subscriberCountDisplay: formatCount(cd.subscriberCount)
    });
  }

  kept.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const trimmed = kept.slice(0, MAX_TOTAL_VIDEOS);

  // Derived "trending" views — real numbers we already have, no extra API calls.
  const topViewed = [...trimmed]
    .filter(v => v.viewCount !== null)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 10);

  const channelMap = new Map();
  for (const v of trimmed) {
    if (!channelMap.has(v.channelId)) {
      channelMap.set(v.channelId, {
        channelId: v.channelId,
        channelTitle: v.channelTitle,
        subscriberCount: channelDetails.get(v.channelId)?.subscriberCount ?? null,
        subscriberCountDisplay: v.subscriberCountDisplay,
        videosInFeed: 0
      });
    }
    channelMap.get(v.channelId).videosInFeed++;
  }
  const topChannels = [...channelMap.values()]
    .filter(c => c.subscriberCount !== null)
    .sort((a, b) => b.subscriberCount - a.subscriberCount)
    .slice(0, 10);

  fs.mkdirSync('docs/data', { recursive: true });
  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      videos: trimmed,
      trending: { topViewed, topChannels }
    }, null, 2)
  );

  console.log(
    `\nDone. Kept ${trimmed.length} videos. Dropped — live/upcoming: ${dropped.live}, ` +
    `too short (Shorts): ${dropped.short}, small channel: ${dropped.smallChannel}, clickbait: ${dropped.clickbait}`
  );
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
