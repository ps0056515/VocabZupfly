# LexiQuest — All phases (built)

## v1.1 — Content & SRS
- **359 words** in `data/words.json` (GRE / GMAT / IELTS tags)
- **Spaced repetition (SM-2)** — flashcards prioritize due + weak words
- **Real streak** — tracks study days in `localStorage`
- **Activity heatmap** — real data from daily study counts

## v1.2 — Decks & onboarding
- **Exam focus** — GRE, GMAT, IELTS, or ALL (onboarding)
- **Placement quiz** — 5-word quick check on first launch
- **Daily goal** — adjustable word target
- **Premium deck** — ~50 advanced words; unlock code: `LEXIQUEST2026` in Settings

## v2 — Mock test & weak drill
- **Mock test** — 20 questions, 10-minute timer
- **Weak drill** — quizzes words marked missed/learning

## v2+ — AI, speak, leagues, sync
- **Speak mode** — speech recognition (device-dependent)
- **Weekly league** — XP leaderboard vs simulated learners
- **AI mnemonics** — local hints + optional `aiEndpoint` in `js/config.js`
- **Firebase** (optional) — set `firebase` in `js/config.js` for anonymous sync
- **Local notifications** — daily reminder via Capacitor (enable in Settings)

## How to run
```powershell
npm run android
```

## Optional: Firebase
Edit `js/config.js`:
```javascript
firebase: {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  appId: '...'
}
```

## Optional: AI backend
Set `aiEndpoint` to your API that accepts `{ word, def }` and returns `{ text: '...' }`.
