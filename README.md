# 🎞️ Our Little Cinema

**Different places. Same movie. Together.**

A private website for two people in different countries. One of you uploads a video, and both of you watch **the same cloud copy** in sync. Play, pause and seek happen on both screens. There's also a little chat, floating reactions, and a one-tap link to your video call.

Built with **Next.js 14 · TypeScript · Tailwind CSS · Supabase (Realtime + Storage)**.

---

## How it works

```
 Ayvon (India)                        Supabase                               Aksa (Italy)
 ┌─────────────┐  upload in 6 MB    ┌──────────────────────────────┐          ┌─────────────┐
 │ browser     │ ─ resumable chunks▶│ Storage: PRIVATE room-videos │          │ browser     │
 │             │   (signed token)   │  <room-code>/<file>.mp4      │◀─signed──│             │
 │             │                    ├──────────────────────────────┤  link    │             │
 │             │ ─ play/pause/seek ▶│ Realtime channel room:<code> │ ────────▶│             │
 │             │ ◀ chat, ❤️, who's  │  broadcast + presence        │ ◀─────── │             │
 │             │   here             ├──────────────────────────────┤          │             │
 │             │ ── save state ───▶ │ Postgres: rooms, messages    │ ◀─ read ─│             │
 └─────────────┘                    └──────────────────────────────┘  on join └─────────────┘
         ▲  /api/upload/start · /api/video/url · /api/video/cleanup  ▲
         └──────── Next.js server (holds the secret key, checks the room code) ┘
```

- **Uploading.** The app's server checks the room code and returns a one-time **signed upload token**. The browser then sends the file **directly to Supabase Storage** using the TUS resumable protocol, in 6 MB chunks. Each chunk is read from disk only when it's sent, so a big film never sits in memory. If the connection drops, the upload continues from the last chunk.
- **Watching.** The room row saves the uploaded file's path (`storage_path`). Each browser asks the server for a **signed playback link** (valid 12 hours) and streams that same cloud file. Seeking works because the files support byte ranges.
- **Sync.** Every play/pause/seek is one event stamped with a shared server clock. Each player computes "where we should be now", nudges its speed slightly for small drift, and jumps for big drift. Anyone who joins or reconnects reads the saved state and lands at the right second.
- **Privacy.** The bucket is **private**, with no storage policies, so the browser key can't list or download anything. Only the server can create signed links, and only for a valid room code and a file inside that room's folder. The secret key lives only on the server (`SUPABASE_SECRET_KEY`, no `NEXT_PUBLIC_` prefix) and is never sent to the browser.

> **Why not Netflix / Prime Video / Disney+?** Their videos are DRM-protected and can't be played or synced by any other website. Upload your own videos, or paste a direct `.mp4` / `.webm` / `.m3u8` link you're allowed to use.

---

## ⚠️ File size and the Supabase plan

| Supabase plan | Max size per uploaded file |
|---|---|
| **Free** | **50 MB** (fine for clips and short videos) |
| **Pro** | up to **500 GB** (full-length films) |

Free projects also have small storage and bandwidth quotas. Streaming a 1.5 GB film to two people uses about 3 GB of bandwidth.

**For full movies:** upgrade the Supabase project to Pro. Then go to **Storage → Settings** and raise the *Upload file size limit* (e.g. 5 GB). In Vercel, set `NEXT_PUBLIC_MAX_UPLOAD_MB` to the same number (e.g. `5000`) and redeploy.

The app deletes the old file whenever you **Change** or **Remove** a video, so storage doesn't fill up.

---

## Environment variables (Vercel → Settings → Environment Variables)

| Key | Value | Visible to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | yes (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your **publishable** key `sb_publishable_…` | yes (designed to be public) |
| `SUPABASE_SECRET_KEY` | your **secret** key `sb_secret_…` (mark it *Sensitive*) | **no, server only** |
| `NEXT_PUBLIC_PERSON_ONE` / `_TWO` | `Ayvon` / `Aksa` | yes |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `50` on Free (optional) | yes |

**Never** create `NEXT_PUBLIC_SUPABASE_SECRET_KEY` or `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. Anything starting with `NEXT_PUBLIC_` is sent to every visitor.

---

## Setup

### New project
1. Create a Supabase project (region **Frankfurt** is a good middle point between India and Italy).
2. **SQL Editor → New query →** paste all of `supabase/schema.sql` → **Run**. This creates the tables, functions and the private `room-videos` bucket.
3. Add the environment variables above (locally: copy `.env.example` → `.env.local`).
4. `npm install && npm run dev` → <http://localhost:3000>

### Upgrading an existing deployment (you already ran the first schema.sql)
1. **SQL Editor →** paste `supabase/migrations/002_cloud_uploads_and_call.sql` → **Run** (safe to run twice).
2. In **Storage**, check that a bucket called **`room-videos`** exists and is **Private**.
3. In Vercel, add **`SUPABASE_SECRET_KEY`** (and optionally `NEXT_PUBLIC_MAX_UPLOAD_MB`).
4. Vercel → **Deployments → ⋯ → Redeploy**.

---

## Using it

1. Open the site → **Create Private Room** → tap **Ayvon**.
2. **Copy Room Link** → send it to Aksa. She opens it and taps **Aksa**.
3. **Upload Video** → pick an MP4. Both of you see *Uploading video… 45%*, then *Video ready ❤️*.
4. Press ▶. It plays for both of you. Pause, skip, or drag the bar and the other screen follows.
5. **Our Call:** paste your Google Meet / Teams / Zoom link once. **Join Our Call ❤️** opens it in a new tab while the cinema stays open.
6. **Logout** clears who you are on this device and returns you to the lobby.

**Keyboard:** `Space` play/pause · `←`/`→` 10 s · `F` fullscreen · `M` mute.

**Formats:** MP4 (H.264 + AAC) works everywhere, including iPhone. WebM works on Chrome, Edge, Firefox and newer Safari. MKV/AVI usually won't play in browsers, so convert those to MP4 first (e.g. with HandBrake).

---

## Project structure

```
app/
  page.tsx                    lobby: Create / Join
  room/[code]/page.tsx        the cinema: player, upload, call, chat, logout
  api/upload/start/route.ts   checks room → one-time signed upload token
  api/video/url/route.ts      checks room + path → signed playback link
  api/video/cleanup/route.ts  deletes replaced/removed videos
components/
  VideoPlayer.tsx             custom player + sync engine
  VideoPicker.tsx             "What are we watching?": Upload / Link / Currently watching
  UploadOverlay.tsx           progress, cancel, retry
  CallCard.tsx                Our Call: add / edit / remove / join
  ChatPanel.tsx, RoomBits.tsx, FloatingReactions.tsx, …
hooks/
  useRoom.ts                  Realtime: state, presence, chat, reactions, call link, upload progress
  useVideoUrl.ts              signed playback link (auto-retry)
lib/
  upload.ts                   resumable upload straight to Supabase Storage
  supabaseAdmin.ts            SERVER-ONLY client (secret key)
  storageConfig.ts, videos.ts, clock.ts, identity.ts, …
supabase/
  schema.sql                  full schema (new projects)
  migrations/002_…sql         upgrade for existing projects
```
