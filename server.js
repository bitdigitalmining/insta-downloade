import express from 'express';
import morgan from 'morgan';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { launch } from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS for local testing (optional)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Util: normalize Instagram URL (accept reel, p, tv, etc. and short forms)
function normalizeInstaUrl(input) {
  try {
    let url = new URL(input.trim());
    if (!/instagram\.com$/.test(url.hostname.replace('www.', ''))) {
      throw new Error('URL is not an instagram.com link');
    }
    // Ensure https and strip query/hash
    url.protocol = 'https:';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch (e) {
    throw new Error('Invalid URL');
  }
}

// Core scraper using Puppeteer to extract media URLs from public posts
async function extractMedia(instaUrl) {
  const browser = await launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  let result = { url: instaUrl, caption: null, author: null, items: [] };
  try {
    const resp = await page.goto(instaUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!resp || !resp.ok()) {
      throw new Error(`Failed to load page (status ${resp ? resp.status() : 'n/a'})`);
    }

    // If Instagram shows a login wall, we still try to read meta tags rendered server-side.
    // Strategy 1: Open Graph tags
    const og = await page.evaluate(() => {
      const get = (sel, attr='content') => {
        const el = document.querySelector(sel);
        return el ? el.getAttribute(attr) : null;
      };
      const ogImage = get('meta[property="og:image"]');
      const ogVideo = get('meta[property="og:video"]') || get('meta[property="og:video:secure_url"]');
      const title = get('meta[property="og:title"]') || document.title || null;
      const desc = get('meta[name="description"]');
      return { ogImage, ogVideo, title, desc };
    });

    // Strategy 2: JSON-LD and preloaded state (best effort, may be absent without login)
    const structured = await page.evaluate(() => {
      const out = {};
      const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent);
      out.ld = ld;
      // Look for window.__additionalData or similar blobs
      const scripts = Array.from(document.scripts).map(s => s.textContent || '');
      out.blobs = scripts.filter(t => t.includes('graphql') || t.includes('display_url') || t.includes('video_url')).slice(0, 5);
      return out;
    });

    // Parse possible JSON blobs for media URLs (best effort)
    const candidates = new Set();
    const addIfUrl = (u) => {
      if (!u) return;
      try {
        const parsed = new URL(u);
        // allow image/video CDN hosts
        if (/cdninstagram|fbcdn|akamai/.test(parsed.hostname)) candidates.add(parsed.toString());
      } catch {}
    };

    addIfUrl(og.ogVideo);
    addIfUrl(og.ogImage);

    for (const blob of structured.blobs) {
      try {
        // extract urls naively
        const re = /(https:\/\/[^"']+?(?:mp4|jpg|jpeg|png|webp))/g;
        let m;
        while ((m = re.exec(blob)) !== null) {
          addIfUrl(m[1].replaceAll('\\', '\'));
        }
      } catch {}
    }

    // Build items from candidates (guess type by extension)
    const items = Array.from(candidates).map(u => ({
      type: /\.mp4(\?|$)/.test(u) ? 'video' : 'image',
      url: u
    }));

    // Caption/author best effort
    let caption = og.desc || null;
    let author = null;
    try {
      if (structured.ld && structured.ld.length) {
        for (const raw of structured.ld) {
          try {
            const data = JSON.parse(raw);
            if (data && data.author && data.author.alternateName) author = data.author.alternateName;
            if (!caption && data && data.caption) caption = data.caption;
          } catch {}
        }
      }
    } catch {}

    // If nothing found, throw
    if (!items.length) {
      throw new Error('Could not locate media URLs. The post may be private, removed, or blocked by a login wall.');
    }

    result.caption = caption;
    result.author = author;
    result.items = items;
    return result;
  } finally {
    await browser.close();
  }
}

// API: extract media
app.get('/api/instagram', async (req, res) => {
  try {
    const input = req.query.url;
    if (!input) return res.status(400).json({ error: 'Missing url parameter' });
    const normalized = normalizeInstaUrl(input);
    const data = await extractMedia(normalized);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || 'Failed to process URL' });
  }
});

// Proxy downloader to avoid CORS issues and to set a proper filename
app.get('/download', async (req, res) => {
  try {
    const u = req.query.url;
    if (!u) return res.status(400).send('Missing url');
    const r = await fetch(u);
    if (!r.ok) return res.status(502).send('Failed to fetch media');
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    const ext = ct.includes('mp4') ? 'mp4' : (ct.includes('jpeg') ? 'jpg' : (ct.split('/')[1] || 'bin'));
    res.setHeader('Content-Type', ct);
    res.setHeader('Content-Disposition', `attachment; filename="instagram-media.${ext}"`);
    r.body.pipe(res);
  } catch (e) {
    res.status(500).send('Download error');
  }
});

app.listen(PORT, () => {
  console.log('Server running on http://localhost:' + PORT);
});
