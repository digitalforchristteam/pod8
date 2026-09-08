let chartsData = null;
let activeCategory = null;

function moveBadge(delta1d, isNew) {
  if (isNew) return `<span class="chart-move new">✨ NEW</span>`;
  if (delta1d === null || delta1d === undefined) return `<span class="chart-move flat">—</span>`;
  if (delta1d > 0) return `<span class="chart-move up">▲ ${delta1d}</span>`;
  if (delta1d < 0) return `<span class="chart-move down">▼ ${Math.abs(delta1d)}</span>`;
  return `<span class="chart-move flat">● same</span>`;
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  container.innerHTML = chartsData.categories.map(cat => `
    <button class="category-pill${cat.id === activeCategory ? ' active' : ''}" data-id="${cat.id}">
      ${escapeHtml(cat.name)}
    </button>
  `).join('');

  container.querySelectorAll('.category-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = Number(btn.dataset.id);
      renderCategoryPills();
      renderChartList();
    });
  });
}

function renderChartList() {
  const container = document.getElementById('chart-list');
  const category = chartsData.categories.find(c => c.id === activeCategory);

  if (!category || !category.shows || category.shows.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">📊</span>No chart data yet for this category.<div class="hint">Run the update workflow to populate it.</div></div>';
    return;
  }

  container.innerHTML = category.shows.map((show, i) => `
    <div class="chart-row" style="--i:${i}">
      <div class="chart-rank">${show.rank}</div>
      ${show.artwork ? `<img src="${show.artwork}" alt="" class="chart-art">` : ''}
      <div class="chart-info">
        <div class="name">${escapeHtml(show.name)}</div>
        <div class="artist">${escapeHtml(show.artist)}</div>
      </div>
      ${moveBadge(show.delta1d, show.isNew)}
    </div>
  `).join('');
}

function renderTrendingVideos(trending) {
  const container = document.getElementById('trending-videos');
  const videos = trending?.topViewed || [];

  if (videos.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">🔥</span>No trending video data yet.<div class="hint">Run the YouTube update workflow first.</div></div>';
    return;
  }

  container.innerHTML = videos.map((v, i) => `
    <article class="card" style="--i:${i}">
      <a href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener" class="thumb-wrap">
        ${v.thumbnail ? `<img src="${v.thumbnail}" alt="${escapeHtml(v.title)}" class="art video-thumb">` : ''}
        ${v.durationSeconds ? `<span class="duration-badge">${formatDuration(v.durationSeconds)}</span>` : ''}
      </a>
      <div class="card-body">
        <h2>${escapeHtml(v.title)}</h2>
        <p class="show">${escapeHtml(v.channelTitle)}</p>
        <p class="meta">${v.viewCountDisplay ? `${v.viewCountDisplay} views` : ''}</p>
        <a class="link" href="https://www.youtube.com/watch?v=${v.videoId}" target="_blank" rel="noopener">Watch ↗</a>
      </div>
    </article>
  `).join('');
}

function renderTopChannels(trending) {
  const container = document.getElementById('top-channels');
  const channels = trending?.topChannels || [];

  if (channels.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">⭐</span>No channel data yet.<div class="hint">Run the YouTube update workflow first.</div></div>';
    return;
  }

  container.innerHTML = channels.map((c, i) => `
    <div class="chart-row" style="--i:${i}">
      <div class="chart-rank">${i + 1}</div>
      <div class="chart-info">
        <div class="name">${escapeHtml(c.channelTitle)}</div>
        <div class="artist">${c.videosInFeed} video${c.videosInFeed === 1 ? '' : 's'} in current feed</div>
      </div>
      <span class="chart-move flat">${c.subscriberCountDisplay || '?'} subs</span>
    </div>
  `).join('');
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadCharts() {
  const updatedEl = document.getElementById('updated-at');

  try {
    const [chartsRes, videosRes] = await Promise.all([
      fetch('data/charts.json?_=' + Date.now()),
      fetch('data/videos.json?_=' + Date.now())
    ]);
    chartsData = await chartsRes.json();
    const videosData = await videosRes.json();

    updatedEl.textContent = chartsData.updatedAt
      ? `Charts last updated: ${new Date(chartsData.updatedAt).toLocaleString()}`
      : 'Waiting for the first automatic update…';

    if (chartsData.categories && chartsData.categories.length > 0) {
      activeCategory = chartsData.categories[0].id;
      renderCategoryPills();
      renderChartList();
    } else {
      document.getElementById('chart-list').innerHTML =
        '<div class="empty-state"><span class="emoji">📊</span>No chart data yet.<div class="hint">Run the &quot;Update Podcast Charts&quot; workflow once.</div></div>';
    }

    renderTrendingVideos(videosData.trending);
    renderTopChannels(videosData.trending);
  } catch (err) {
    console.error(err);
    document.getElementById('chart-list').innerHTML = '<div class="empty-state"><span class="emoji">😕</span>Could not load chart data.<div class="hint">Please try refreshing shortly.</div></div>';
  }
}

loadCharts();
