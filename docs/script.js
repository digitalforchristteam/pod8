function renderSkeletons(container, count = 6) {
  container.innerHTML = Array.from({ length: count }).map((_, i) => `
    <div class="skeleton-card" style="--i:${i}">
      <div class="skeleton-block skeleton-art"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line short"></div>
    </div>
  `).join('');
}

async function loadEpisodes() {
  const container = document.getElementById('episode-list');
  const updatedEl = document.getElementById('updated-at');
  renderSkeletons(container);

  try {
    const res = await fetch('data/episodes.json?_=' + Date.now());
    const data = await res.json();

    updatedEl.textContent = data.updatedAt
      ? `Last updated: ${new Date(data.updatedAt).toLocaleString()}`
      : 'Waiting for the first automatic update…';

    if (!data.episodes || data.episodes.length === 0) {
      container.innerHTML = '<div class="empty-state"><span class="emoji">🌱</span>No episodes yet.<div class="hint">Run the update workflow once to populate this page.</div></div>';
      return;
    }

    container.innerHTML = data.episodes.map((ep, i) => `
      <article class="card" style="--i:${i}">
        ${ep.showArt ? `<img src="${ep.showArt}" alt="${escapeHtml(ep.show)}" class="art">` : ''}
        <div class="card-body">
          <h2>${escapeHtml(ep.title)}</h2>
          <p class="show">${escapeHtml(ep.show)}</p>
          <p class="meta">${ep.pubDate ? new Date(ep.pubDate).toLocaleDateString() : ''}${ep.duration ? ' • ' + escapeHtml(ep.duration) : ''}</p>
          <p class="desc">${escapeHtml(ep.description || '')}</p>
          ${ep.audioUrl ? `<audio controls src="${ep.audioUrl}"></audio>` : ''}
          ${ep.link ? `<a class="link" href="${ep.link}" target="_blank" rel="noopener">View episode ↗</a>` : ''}
        </div>
      </article>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><span class="emoji">😕</span>Could not load episodes.<div class="hint">Please try refreshing shortly.</div></div>';
    console.error(err);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

loadEpisodes();
