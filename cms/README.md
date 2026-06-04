# LexiQuest Content Manager (CMS)

Business editors can add and change vocabulary **without editing code**. Two ways to work:

| Method | Best for |
|--------|----------|
| **Web CMS** (`npm run cms`) | Day-to-day edits, one word at a time, publish in one click |
| **Google Sheets + CSV** | Bulk edits, copywriters, offline review |

---

## Quick start (web CMS)

```bash
npm run dev
```

One port for everything:

| URL | Purpose |
|-----|---------|
| http://localhost:3456/lexiquest.html | Student app |
| http://localhost:3456/cms/ | Content manager |

1. Run `npm run dev`
2. Open **http://localhost:3456/cms/**
3. Sign in with API key: `lexiquest-cms-dev` (or set `CMS_API_KEY` in the environment)
4. Edit **Words**, **Lists**, **Dictionary**, or **Import CSV**
5. Click **Publish to app** — updates `data/*.json` and runs `npm run prepare:web`

From the student app: **Settings → Open Content Manager**.

---

## What business can edit

| Area | CMS tab | Notes |
|------|---------|--------|
| Definitions, examples, synonyms | **Words** | Master word bank used everywhere |
| List titles, GRE vs dictionary | **Lists** | Structure of GRE groups still via CSV |
| Dictionary membership | **Dictionary** | Add words to flat lists |
| Bulk changes | **Import CSV** | From Google Sheets export |
| Handoff to Sheets | **Export** | Download CSVs |

Student-only edits (example overrides in the app) stay in each user’s browser — not in CMS.

---

## Google Sheets workflow

```bash
npm run cms:export    # creates cms/export/*.csv
```

1. Upload CSVs to a Google Sheet (one tab per file).
2. Editors change rows in Sheets.
3. Download each tab as CSV into `cms/import/`.
4. Either:
   - **Web CMS → Import CSV → Publish**, or
   - `npm run cms:import` then `npm run prepare:web`

### CSV files

| File | Contents |
|------|----------|
| `Words.csv` | word, phonetic, pos, def, example, syn, ant, tags, premium, stub |
| `WordLists.csv` | id, listNum, title, listType (`grouped` \| `dictionary`), icon, color |
| `Groups.csv` | GRE synonym groups |
| `GroupWords.csv` | Word ↔ group membership |
| `DictionaryWords.csv` | Word ↔ dictionary list |

---

## Security (production)

```bash
set CMS_API_KEY=your-secret-key-here
set CMS_PORT=3457
npm run cms
```

Update `cmsApiKey` in `js/config.js` only for the in-app link query param — prefer sharing the key out of band.

Do not expose the CMS port on the public internet without HTTPS and a strong key.

---

## Live content without rebuild (optional)

1. Publish from CMS (writes `data/content-manifest.json` with a new `version`).
2. Host `words-merged.json`, `word-lists.json`, and `content-manifest.json` on a CDN or Firebase Storage.
3. In `js/config.js`:

```javascript
contentBaseUrl: 'https://your-cdn.com/lexiquest/content',
contentVersion: 1730123456,  // match manifest version
```

4. Redeploy the app shell once; later content updates only need CDN upload + version bump.

---

## API (for integrations)

All routes require header `X-CMS-Key: <CMS_API_KEY>`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cms/content` | Full words + lists + manifest |
| POST | `/api/cms/word` | Upsert one word |
| PUT | `/api/cms/words` | Replace all words |
| PUT | `/api/cms/lists` | Replace word-lists.json |
| POST | `/api/cms/dictionary/add` | Add word to dictionary list |
| POST | `/api/cms/import/csv` | Body: `{ "Words.csv": "..." }` |
| GET | `/api/cms/export/csv` | All CSVs as JSON |
| POST | `/api/cms/publish` | Body: `{ "syncWeb": true }` |

---

## Files

| Path | Role |
|------|------|
| `scripts/cms-lib.js` | Import/export/publish engine |
| `scripts/cms-server.mjs` | HTTP server + API |
| `cms/admin.html` | Business UI |
| `data/content-manifest.json` | Published version stamp |
