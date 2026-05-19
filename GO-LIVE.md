# LexiQuest — Go live checklist

## What was added in the project

- **App icon & splash** — `resources/icon.png`, `resources/splash.png` (regenerate: `npx capacitor-assets generate --android`)
- **Offline fonts** — bundled in `www/fonts/` (Syne + Plus Jakarta Sans)
- **Privacy policy** — `www/privacy-policy.html` (also linked from **Stats** screen)
- **Splash plugin** — `@capacitor/splash-screen`

## Before each Android build

```powershell
cd d:\Work\Projects\Lexiquest
npm run android
```

This copies `lexiquest.html`, copies fonts, syncs Capacitor, opens Android Studio.

## Testing (about 1 hour)

On a **real phone**:

1. Run from Android Studio (release or debug).
2. Complete smoke test: all modes, pronounce, back button, kill app and reopen (progress saved).
3. Turn on **airplane mode** — app should still work (fonts + words offline).

## Host privacy policy (required for Play Store)

Google Play needs a **public HTTPS URL**. Options:

### Option A — GitHub Pages (free)

1. Create a GitHub repo, push this project (or only `www/privacy-policy.html`).
2. **Settings → Pages →** source: main branch, folder `/www` or copy policy to `docs/`.
3. URL will look like: `https://yourusername.github.io/lexiquest/privacy-policy.html`
4. Paste that URL in Play Console → **Privacy policy**.

### Option B — Any website

Upload `www/privacy-policy.html` to your domain, e.g. `https://yoursite.com/privacy-policy.html`.

**Before publishing:** change the contact email in `privacy-policy.html` from `privacy@lexiquest.app` to your real address.

## Signed release build (Play Store)

1. Android Studio → **Build → Generate Signed Bundle / APK**.
2. Choose **Android App Bundle (AAB)**.
3. Create a new keystore — **back up the `.jks` file and passwords** (lost = cannot update the app).
4. Build variant: **release**.

## Google Play Console

1. [play.google.com/console](https://play.google.com/console) — pay **$25** one-time developer fee.
2. **Create app** → LexiQuest.
3. **Internal testing** track first → upload AAB → add your Gmail as tester.
4. Complete:
   - Store listing (short + full description, 2+ phone screenshots)
   - Privacy policy URL (hosted HTTPS)
   - **Data safety**: likely “No data collected” for current app
   - Content rating questionnaire
   - Target audience
5. Promote to **Production** when ready.

## Store assets to prepare

| Asset | Size / notes |
|-------|----------------|
| App icon | 512×512 PNG (Play listing) — use `resources/icon.png` |
| Feature graphic | 1024×500 PNG |
| Screenshots | 2–8 phone screenshots (1080×1920 or similar) |
| Short description | ≤ 80 characters |
| Full description | ≤ 4000 characters |

## Database?

**Not required** for v1. Progress is on-device only. Add Firebase/Supabase later if you need accounts and sync.

## iOS (later)

Requires Mac + Apple Developer ($99/year): `npx cap add ios` → Xcode → App Store.

## Your immediate next steps

1. `npm run android` → Run on phone → quick retest (icon, splash, offline, privacy link).
2. Host `privacy-policy.html` and note the URL.
3. Replace contact email in privacy policy.
4. Generate **signed AAB** in Android Studio.
5. Upload to Play Console **Internal testing**.
