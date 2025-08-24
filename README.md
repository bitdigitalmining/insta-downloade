# Instagram Public Downloader (Full‑Stack)

**Use responsibly.** Only download content you own or have permission to save. Respect Instagram's Terms of Use and the creator's rights.

## What this does
- Frontend: a single-page UI where you paste a public Instagram post/Reel URL.
- Backend: Node.js + Express + Puppeteer loads the public page and extracts direct media URLs (images/videos) from server-rendered meta tags or in-page JSON.
- Download proxy endpoint to save files with proper filenames and avoid CORS issues.

⚠️ **Limitations**
- Private posts, stories, or content behind a login wall will not work.
- Instagram changes may break selectors. Update the scraper logic if extraction fails.

## Local setup
1. Install Node 18+.
2. In the project folder:
   ```bash
   npm i
   npm run dev
   ```
3. Open http://localhost:3000 and paste a public Instagram URL (e.g., a Reel or Photo).

> If Puppeteer fails to launch Chromium on low-memory environments, try adding:
> ```bash
> PUPPETEER_SKIP_DOWNLOAD=true
> ```
> and ensure a system Chromium is available, or deploy on a platform that supports headless Chrome.

## Deploy to Render (quick notes)
- Create a **Web Service**.
- Build command: `npm install`
- Start command: `npm start`
- Environment:
  - `NODE_VERSION=18`
  - Add `--no-sandbox` flags are already included in the code.

## Project structure
```
insta-downloader/
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  └─ script.js
├─ server.js
├─ package.json
└─ README.md
```

## Legal & ethical use
- Confirm you have rights to download or archive the content.
- Comply with Instagram’s Terms and any local laws on content downloading and reuse.
- Avoid automated bulk scraping or circumventing technical protection measures.
