# LexiQuest — Android app

The Android app is your web UI (`www/index.html`) wrapped with **Capacitor**. Progress is saved on the device via `localStorage`.

## What you need (one-time)

1. **Node.js** (LTS) — [nodejs.org](https://nodejs.org/)
2. **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio)
   - During setup, install **Android SDK**, **SDK Platform**, and an **emulator** (or use a USB phone with Developer options → USB debugging).

3. **Environment variables** (Android Studio often sets these; if `cap run` fails, add manually):
   - `ANDROID_HOME` → e.g. `C:\Users\YourName\AppData\Local\Android\Sdk`
   - Add to `Path`: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\tools`

4. **JDK 17** — Android Studio’s bundled JDK is fine.

## Project layout

```text
Lexiquest/
  www/index.html      ← app UI (edit this, then sync)
  www/js/native-bridge.js
  android/            ← native Android project (generated)
  capacitor.config.json
  package.json
```

## Daily workflow

After changing the app in `www/`:

```powershell
cd d:\Work\Projects\Lexiquest
npm run cap:sync
```

### Run on emulator or phone

```powershell
npm run android
```

This opens **Android Studio**. Then:

1. Wait for Gradle sync to finish.
2. Pick a device (emulator or connected phone).
3. Click the green **Run** ▶ button.

Or from the terminal (device/emulator must already be running):

```powershell
npm run android:run
```

### Build a debug APK (share/install without Play Store)

```powershell
cd android
.\gradlew.bat assembleDebug
```

APK path:

`android\app\build\outputs\apk\debug\app-debug.apk`

Copy that file to your phone and open it (allow “Install unknown apps” if prompted).

## Release build (Google Play)

1. Create a keystore and sign the app (Android Studio: **Build → Generate Signed Bundle / APK**).
2. Prefer **Android App Bundle (AAB)** for Play Console upload.
3. Add store listing, screenshots, and a privacy policy URL.

## Release prep

See **[GO-LIVE.md](./GO-LIVE.md)** for Play Store checklist, privacy policy hosting, and signed AAB steps.

Regenerate icon/splash after changing `resources/icon.png` or `resources/splash.png`:

```powershell
npm run assets:android
npm run cap:sync
```

## Tips

- **Back button**: From any screen except Home, Android back goes to Home; on Home, back exits the app.
- **Browser preview**: Open `www/index.html` in Chrome, or keep using root `lexiquest.html` for quick edits (copy to `www/` before sync).
- **Sync command**: Always run `npm run cap:sync` after editing `www/` before rebuilding in Android Studio.

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Gradle sync failed | Open Android Studio → SDK Manager → install latest SDK Platform + Build-Tools |
| No devices | Start an AVD (Device Manager) or enable USB debugging on phone |
| White screen | Run `npm run cap:sync`, rebuild; check Logcat in Android Studio |
| `JAVA_HOME` errors | Point to JDK 17 (Android Studio → Settings → Build → Gradle JDK) |
