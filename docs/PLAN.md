# Media Analysis System — Design Plan

## Goal
Recover ~200 archive documentary CDs, host the video on YouTube, and run a **zero-server-cost**
system where Admins recover/upload/assign, Analysts write publishable clip notes, and Editors
cut clips using their own tools.

## Confirmed decisions
- Masters kept on external HDD as cold backup; **YouTube Unlisted** is the pipeline media source and the team's streaming layer.
- Admin does no command/audio work: recover → upload → paste link → assign.
- Audio for transcription fetched **from YouTube via yt-dlp**.
- **Cloud-only compute:** GitHub Actions (pipeline) + Groq (Whisper) + Gemini (free). No local installs for the team.
- **Three roles, many-to-many** (`admin`, `analyst`, `editor`); Admin grants/revokes multiple roles.
- One analyst per video; hidden until assigned; assignment locks the video to that analyst/editor (+ admins).
- Auth.js (NextAuth) **credentials** provider; **Admin-managed email/password** accounts; no self-signup.
- Authorization enforced **in the app layer** (Next.js server actions / pages).
- Same multi-role user may be both analyst and editor of the same video.
- Analyst writes final notes; AI only drafts.
- Editing supports **two modes**: (A) in-system rough-cut via generated FFmpeg commands, (B) download and edit externally. No finished-clip storage.

## Access control (app-layer)
- Analyst → videos where `assigned_analyst_id = me`.
- Editor → completed pool (`status='completed' AND assigned_editor_id IS NULL`) + videos assigned to me.
- Admin → everything.
- Multi-role → union of the above.

## Video status lifecycle
```
recovered → linked → assigned_to_analyst → in_analysis → completed
   → [editor pool] → assigned_to_editor → in_editing → edited → delivered
```
`analysis_state` (pending/processing/done/error) tracks the AI pipeline independently.

## Pipeline
1. Admin registers a YouTube URL → `analysis_state='pending'`.
2. GitHub Actions (every 3h) claims pending rows (`FOR UPDATE SKIP LOCKED`).
3. yt-dlp audio → Groq Whisper (chunked) → transcript segments.
4. yt-dlp low-res video → PySceneDetect → scenes + keyframes → R2.
5. Gemini free tier → highlight draft notes.
6. Write transcript/scenes/notes to Neon → `analysis_state='done'`.

## Data model (Neon)
`users`, `user_roles`, `discs`, `videos`, `transcripts`, `scenes`, `notes`, `assignments`, `activity_log`.

## Free stack
ddrescue · FFmpeg · yt-dlp · YouTube Unlisted · faster-whisper/Groq · PySceneDetect ·
Gemini free tier · Neon Postgres · Auth.js · Vercel · Cloudflare R2 · GitHub Actions ·
any NLE (e.g. DaVinci Resolve free).

## Phases
0. Probe one CD → confirm format (`recovery/probe.ps1`).
1. Recovery + catalog (`rip.ps1`, `extract.ps1`, Admin → Videos).
2. YouTube links + yt-dlp fetch.
3. Transcript + scene detect (Actions).
4. Neon schema + Auth.js + multi-role (done).
5. Vercel review app (admin/analyst/editor) (done).
6. Editor workflow + rough-cut.
7. Publishing.

## Risks
- yt-dlp breakage → keep updated; retry/backoff.
- YouTube ToS/copyright → upload rights-owned content only.
- Scratched discs → ddrescue logging.
- Groq free daily limits → small `POLL_BATCH_SIZE`; fallback to Whisper in Actions.
- GitHub Actions minutes → public repo = unlimited.
- Rotate any keys shared in chat before production.