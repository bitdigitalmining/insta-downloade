const form = document.getElementById('form');
const urlInput = document.getElementById('url');
const statusBox = document.getElementById('status');
const results = document.getElementById('results');

function setStatus(msg) { statusBox.textContent = msg || ''; }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  results.innerHTML = '';
  setStatus('Fetching…');
  const url = urlInput.value.trim();
  if (!url) return;

  try {
    const res = await fetch(`/api/instagram?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    setStatus('Found ' + data.data.items.length + ' media file(s).');
    render(data.data);
  } catch (err) {
    setStatus(err.message || 'Error');
  }
});

function render(data) {
  const { items, caption, author } = data;
  for (const item of items) {
    const el = document.createElement('div');
    el.className = 'item';
    if (item.type === 'video') {
      el.innerHTML = `
        <video class="thumb" controls src="${item.url}"></video>
        <div class="actions">
          <div class="meta">Video</div>
          <a class="button" href="/download?url=${encodeURIComponent(item.url)}">Download</a>
        </div>
      `;
    } else {
      el.innerHTML = `
        <img class="thumb" src="${item.url}" alt="Instagram media" />
        <div class="actions">
          <div class="meta">Image</div>
          <a class="button" href="/download?url=${encodeURIComponent(item.url)}">Download</a>
        </div>
      `;
    }
    results.appendChild(el);
  }
  if (caption || author) {
    const meta = document.createElement('div');
    meta.className = 'caption';
    meta.textContent = [author ? `Author: ${author}` : null, caption].filter(Boolean).join(' • ');
    results.appendChild(meta);
  }
}
