# Build & Run Commands Guide

This document lists all the commands required to run the web application, build Android APKs (debug and release), sync Capacitor assets, and run content-processing/CMS utilities.

---

## 📱 Android Build Commands

To build the Android package, you can use the wrapper script in the `android` directory or use the mapped NPM scripts.

### 1. Build Debug APK
* **Using NPM (Recommended)**:
  ```bash
  npm run android:build
  ```
  *(This automatically runs `npm run prepare:web` and triggers the gradle build)*
* **Using Gradle (Manual)**:
  ```bash
  # Windows
  cd android && .\gradlew.bat assembleDebug
  
  # macOS / Linux
  cd android && ./gradlew assembleDebug
  ```
  *The generated APK will be available at: `android/app/build/outputs/apk/debug/app-debug.apk`*

### 2. Build Release APK (unsigned)
* **Using Gradle**:
  ```bash
  # Windows
  cd android && .\gradlew.bat assembleRelease
  
  # macOS / Linux
  cd android && ./gradlew assembleRelease
  ```
  *The generated APK will be available at: `android/app/build/outputs/apk/release/app-release-unsigned.apk`*

### 3. Build Release App Bundle (AAB for Google Play Store)
* **Using Gradle**:
  ```bash
  # Windows
  cd android && .\gradlew.bat bundleRelease
  
  # macOS / Linux
  cd android && ./gradlew bundleRelease
  ```
  *The generated bundle will be available at: `android/app/build/outputs/bundle/release/app-release.aab`*

---

## 💻 Web Development & Local Run

### 1. Start Web Dev Server
Runs the web dashboard and CMS administration locally.
```bash
npm run dev
```
* **App URL**: [http://localhost:3456/lexiquest.html](http://localhost:3456/lexiquest.html)
* **CMS URL**: [http://localhost:3456/cms/](http://localhost:3456/cms/)

### 2. Compile Web Assets
Copies source files to the production/Capacitor folder (`www/`).
```bash
npm run prepare:web
```

---

## 🔄 Capacitor Synchronization & Platform Commands

### 1. Sync All Capacitor Platforms
Prepares the web output and syncs changes to iOS and Android modules.
```bash
npm run cap:sync
```

### 2. Run / Open on Android
* **Launch Android Studio project**:
  ```bash
  npm run android
  ```
* **Install and run directly on connected device/emulator**:
  ```bash
  npm run android:run
  ```

### 3. Run / Open on iOS
* **Open Xcode project**:
  ```bash
  npm run ios
  ```
* **Install and run directly on connected iOS device/simulator**:
  ```bash
  npm run ios:run
  ```
* **Xcode compilation check**:
  ```bash
  npm run ios:build
  ```

---

## 🛠️ Content & CMS Utilities

* **Export CMS database to CSV**:
  ```bash
  npm run cms:export
  ```
* **Import CSV data into CMS database**:
  ```bash
  npm run cms:import
  ```
* **Seed dictionary lists**:
  ```bash
  npm run seed:dictionary
  ```
* **Enrich dictionary examples**:
  ```bash
  npm run enrich:content
  ```
* **Generate App Assets (Icons & Splash screens)**:
  ```bash
  # Android only
  npm run assets:android
  
  # iOS only
  npm run assets:ios
  
  # Both platforms
  npm run assets:all
  ```
