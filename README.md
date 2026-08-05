# LexiQuest

Vocabulary trainer for GRE, GMAT, and IELTS.

| Target | Location |
|--------|----------|
| **Android app** | Built from **`lexiquest.html`** — see **[ANDROID.md](./ANDROID.md)** |
| **Browser demo** | Open `lexiquest.html` in Chrome |

**Workflow:** Edit `lexiquest.html` → `npm run android` (copies to `www/`, fonts, sync, opens Android Studio).

**Deploy to a server:** [DEPLOYMENT.md](./DEPLOYMENT.md) · **Go live (Play Store):** [GO-LIVE.md](./GO-LIVE.md) · Privacy policy: `www/privacy-policy.html`

---

## Server Environment Variables Configuration

If you are running or deploying the Node.js backend server, configure the following environment variables (via system env or a `.env` file):

| Variable | Description | Default / Example |
|----------|-------------|-------------------|
| `PORT` | The port the Node.js server runs on | `3456` |
| `MONGO_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/vocabzupfly` |
| `JWT_SECRET` | Secret key for Access Token signatures | `vz-auth-secret-key-vocabzupfly-2026` |
| `JWT_REFRESH_SECRET` | Secret key for Refresh Token signatures | `vz-refresh-secret-key-vocabzupfly-2026` |
| `SUPER_ADMIN_EMAIL` | Email for the default Super Admin account | `1999rkgupta@gmail.com` |
| `SUPER_ADMIN_PASSWORD` | Password for the default Super Admin account | `Password@123` |
| `COOKIE_SECURE` | Enable secure cookies (set to `true` in production with HTTPS) | `false` |
| `COOKIE_SAME_SITE` | Cookie SameSite policy (`lax`, `strict`, `none`) | `lax` |

---

## First-Time Database Seeding (Super Admin Setup)

To seed initial database structures (organizations, word lists, words, tense content) and create the default **Super Admin** account:

1. **Set Up MongoDB Connection**:
   Ensure MongoDB is running and `MONGO_URI` is correctly configured in your environment variables.

2. **Run the Seeder**:
   Execute the seed script from the project root:
   ```bash
   npm run seed
   ```
   This will:
   - Connect to MongoDB.
   - Create the default organization (`Panimalar`).
   - Create the **Super Admin** user using your `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` configurations.
   - Load and seed Word Lists, Vocabulary Words, and Tense Groups/questions.

3. **Log In**:
   After seeding completes, use your Super Admin email and password to log in and manage the application.

