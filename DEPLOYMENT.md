# LexiQuest — Server deployment guide

Deploy LexiQuest on a **new web server** as a static site. No database is required for core functionality (progress is stored in the user’s browser via `localStorage`).

---

## What you are deploying

| Item | Purpose |
|------|---------|
| `www/` (recommended document root) | Built app: `index.html`, `js/`, `data/`, `css/`, `fonts/` |
| `data/words.json` | Vocabulary (~359 words), loaded at runtime |
| `js/config.js` | App settings (optional Firebase, AI endpoints) |

**Optional:** Node process for the AI tutor API (`npm run tutor:api`). The app works without it using built-in tutor replies.

---

## Requirements

### Server

- Any Linux/Windows host with a web server (Nginx, Apache, Caddy, IIS, or object storage + CDN)
- **HTTPS** recommended (required for some browser APIs; needed for Play Store privacy policy hosting)
- **No MySQL/PostgreSQL/MongoDB** unless you add your own backend later

### Build machine (one-time or CI)

- **Node.js 18+** and **npm** (only to run build scripts; the live server can serve files only)
- Disk space: ~50 MB for project + `node_modules`

---

## 1. Prepare the release bundle

On your machine or CI runner, from the project root:

```bash
cd /path/to/VocabZupfly

npm install
npm run prepare:web
```

This runs:

- `copy:web` — `lexiquest.html` → `www/index.html`, copies `js/`, `data/`, `css/`
- `copy:fonts` — bundles fonts into `www/fonts/`

Verify the output:

```bash
ls www/
# index.html  js/  data/  css/  fonts/  manifest.json  privacy-policy.html
```

**Upload to the server:** the entire `www/` folder (or sync via Git/rsync).

---

## 2. Upload to the server

### Option A — SCP/rsync (typical VPS)

```bash
rsync -avz --delete www/ user@your-server.com:/var/www/lexiquest/
```

### Option B — SFTP / panel

Upload contents of `www/` into the site’s document root (not the parent folder name alone — upload *inside* so `index.html` is at the web root).

### Option C — Git deploy

```bash
# On server
git clone <your-repo> /var/www/lexiquest-src
cd /var/www/lexiquest-src
npm ci
npm run prepare:web
ln -sfn /var/www/lexiquest-src/www /var/www/lexiquest
```

---

## 3. Web server configuration

### Nginx (recommended)

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name vocab.example.com;

    root /var/www/lexiquest;
    index index.html;

    # SPA-style fallback: all routes serve the app
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets (bump when you change ?v= on scripts)
    location ~* \.(js|css|woff2|json|png|ico|svg)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # JSON word list — shorter cache if you update words often
    location /data/ {
        expires 1h;
        add_header Cache-Control "public";
    }

    gzip on;
    gzip_types text/css application/javascript application/json;
}
```

Enable HTTPS (Let’s Encrypt):

```bash
sudo certbot --nginx -d vocab.example.com
```

### Apache

```apache
<VirtualHost *:443>
    ServerName vocab.example.com
    DocumentRoot /var/www/lexiquest

    <Directory /var/www/lexiquest>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
        FallbackResource /index.html
    </Directory>

    # Enable mod_ssl and certificates (certbot or your CA)
</VirtualHost>
```

### Caddy (automatic HTTPS)

```caddy
vocab.example.com {
    root * /var/www/lexiquest
    file_server
    try_files {path} /index.html
}
```

---

## 4. Production configuration

Edit **`js/config.js`** before `npm run prepare:web` (then redeploy `www/js/config.js`).

| Setting | Production suggestion |
|---------|------------------------|
| `enableAllFeatures` | `false` for public store builds; `true` only for internal/demo |
| `firebase` | `null` unless you configure Firebase (optional cloud sync) |
| `tutorEndpoint` / `aiEndpoint` | Your HTTPS API URL, or leave unset for built-in tutor only |
| `assetVersion` | Bump when you change JS/CSS so browsers refresh caches |

Example tutor endpoint on the same server:

```javascript
tutorEndpoint: 'https://vocab.example.com/api/tutor',
aiEndpoint: 'https://vocab.example.com/api/tutor',
```

After editing config:

```bash
npm run prepare:web
# redeploy www/
```

---

## 5. Optional: AI tutor API on the server

The sample API is a small Node HTTP server (not required for the app to load).

```bash
# On server (separate port or behind reverse proxy)
cd /var/www/lexiquest-src
npm install --omit=dev
node scripts/tutor-api-example.mjs
# Listens on http://127.0.0.1:8787/tutor by default
```

**Nginx reverse proxy** (example):

```nginx
location /api/tutor {
    proxy_pass http://127.0.0.1:8787/tutor;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Run under **systemd** or **PM2** so it restarts on reboot. Replace the stub in `scripts/tutor-api-example.mjs` with your LLM provider for real AI answers.

---

## 6. Optional: Firebase cloud sync

1. Create a Firebase project → enable **Authentication** (anonymous) and **Firestore**.
2. Set config in `js/config.js`:

```javascript
firebase: {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  appId: '...',
},
```

3. Include Firebase SDK scripts in `lexiquest.html` if not already loaded (see `js/firebase-sync.js`).
4. Run `npm run prepare:web` and redeploy.

No server-side code is required; the client talks to Firebase directly.

---

## 7. Privacy policy URL (Play Store)

Host `www/privacy-policy.html` on the same domain:

- `https://vocab.example.com/privacy-policy.html`

Edit the contact email inside that file before going live.

---

## 8. Post-deploy checklist

- [ ] Open `https://your-domain/` — home screen loads
- [ ] Open DevTools → Network — `data/words.json` returns **200**
- [ ] Start a quiz and a lesson — no console errors
- [ ] Hard refresh (`Ctrl+Shift+R`) after updates to bust cache
- [ ] Mobile: add to home screen / test in Chrome responsive mode
- [ ] Optional: AI tutor sends messages (with or without API)
- [ ] HTTPS certificate valid

### Quick local smoke test (before upload)

```bash
npm run dev
# Open http://localhost:3456/lexiquest.html
```

---

## 9. Updating a live server

```bash
# Build machine
git pull
npm ci
npm run prepare:web
rsync -avz --delete www/ user@server:/var/www/lexiquest/
```

Bump `assetVersion` in `js/config.js` when JavaScript or CSS changes so users get new files.

---

## 10. Android APK (not the same as web server)

The Play Store app is built from the same `www/` bundle via Capacitor:

```bash
npm run cap:sync
# Then Android Studio → signed AAB
```

See **[ANDROID.md](./ANDROID.md)** and **[GO-LIVE.md](./GO-LIVE.md)** for APK/Play Store steps. You do **not** need to run Node on the server for the APK to work offline.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Blank page | Check document root points to `www/`; `index.html` exists |
| “Loading…” forever | `data/words.json` missing or wrong path; check Network tab |
| Old UI after deploy | Bump `?v=` query strings in `index.html` scripts or `assetVersion` |
| Fonts look wrong | Run `npm run copy:fonts`; ensure `www/fonts/` was uploaded |
| AI tutor network error | CORS/HTTPS: API must be HTTPS if the site is HTTPS; or use built-in tutor |
| 404 on refresh | Enable `try_files` / `FallbackResource` to `index.html` |

---

## File layout on the server (reference)

```
/var/www/lexiquest/
├── index.html          # Main app (from lexiquest.html)
├── manifest.json
├── privacy-policy.html
├── js/
│   ├── config.js       # Production settings
│   ├── boot.js
│   └── ...
├── data/
│   └── words.json
├── css/
│   ├── kanban.css
│   └── desktop.css
└── fonts/
    └── *.woff2
```

---

## Summary

| Component | Required? |
|-----------|-----------|
| Static web server + `www/` files | **Yes** |
| Database | **No** |
| Node on server | **No** (only for optional tutor API) |
| Firebase | **No** (optional sync) |

For questions about the Android build, see [ANDROID.md](./ANDROID.md).
