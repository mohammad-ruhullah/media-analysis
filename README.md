# Media Analysis System

Recover archive documentary CDs, host them on YouTube, and run a **free, cloud-only**
system where:

- **Admins** recover CDs, upload to YouTube (Unlisted), register links, assign analysts/editors.
- **Analysts** review assigned videos and write publishable clip notes (title, caption, hashtags, timecodes).
- **Editors** download the source and cut clips in their own tool, using the notes + timecodes.

Everything runs on free tiers: **GitHub Actions** (pipeline), **Vercel** (web app),
**Neon Postgres** (data), **Cloudflare R2** (thumbnails), **YouTube** (media),
**Groq** (Whisper) and **Google Gemini** (highlight drafts).

## Architecture

```
Laptop: rip CD → upload master to YouTube (Unlisted) → paste link
        │
GitHub Actions (scheduled): yt-dlp → Groq Whisper → PySceneDetect → Gemini → Neon
        │
Vercel app (any browser): Admin console · Analyst workspace · Editor dashboard
```

The only local step is physically ripping the CD. No local installs are needed for
analysts or editors.

## Repository layout

```
recovery/   probe.ps1, rip.ps1, extract.ps1   (run on the recovery laptop)
pipeline/   cloud analysis workers (Python)   (run by GitHub Actions)
web/        Next.js app (Vercel) — admin/analyst/editor
db/         schema.sql + migrate.mjs
docs/       PLAN.md (full design)
.github/    workflows (analysis-pipeline)
```

## Setup

### 1. Database (Neon)
```bash
npm install            # root tooling (pg, bcryptjs, dotenv)
cp .env.example .env   # fill in DATABASE_URL, SEED_ADMIN_*, keys
npm run db:migrate     # creates schema + seeds the admin user
```

### 2. Web app (local)
```bash
cd web
cp ../.env.example .env.local   # or copy the values from the root .env
npm install
npm run dev                     # http://localhost:3000
```
Log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Create users and roles in
**Admin → Users**.

### 3. Web app deploy (Vercel)
- Import the GitHub repo into Vercel.
- **Root Directory: `web`**.
- Add environment variables: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`.
- Deploy.

### 4. Cloud pipeline (GitHub Actions)
Add repo **Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon connection strings |
| `GEMINI_API_KEY` | Google AI Studio key |
| `GROQ_API_KEY` | Groq key |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 |
| `R2_ENDPOINT` | R2 S3 endpoint |

Optional repo **Variables**: `GEMINI_MODEL`, `GROQ_WHISPER_MODEL`, `R2_BUCKET`,
`R2_PUBLIC_BASE_URL`.

The workflow `.github/workflows/pipeline.yml` runs every 3 hours and can be triggered
manually from the Actions tab.

## Recovery (recovery laptop)

```powershell
# 1. inspect a disc (Phase 0)
powershell -ExecutionPolicy Bypass -File recovery\probe.ps1

# 2. rip to ISO with ddrescue (needs WSL + gddrescue), or -FileCopy for data CDs
powershell -ExecutionPolicy Bypass -File recovery\rip.ps1 -Drive D: -Label DOC001

# 3. extract video files into storage\masters\<label>
powershell -ExecutionPolicy Bypass -File recovery\extract.ps1 -Source D: -Label DOC001
```
Then upload the master(s) to YouTube (Unlisted) and register the link in
**Admin → Videos**.

## Roles

A user can hold multiple roles (`admin`, `analyst`, `editor`). Effective permissions
are the union. See `docs/PLAN.md` for the full permission matrix and workflow.

## Security

**Rotate all keys that were shared in chat** before going live. Never commit `.env`
files; use Vercel/GitHub secret stores in production.