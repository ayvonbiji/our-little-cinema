# 🎞️ Our Little Cinema

**Different places. Same movie. Together.**

A private website for two people in different countries. Inside one private room you get:

- **💻 Our Call** (the home screen): your Microsoft Teams (or Google Meet / Zoom) meeting, saved to the room, with the chat beside it.
- **🎬 Watch**: one of you uploads a video and both of you watch **the same cloud copy** in sync. Play, pause and seek happen on both screens.
- Live chat, floating reactions, "I'm here ❤️", and "Send a kiss 💋".

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

## 💻 Our Call and Microsoft Teams embedding (please read)

1. Paste the Teams link and click **Save Meeting**. It's stored on the room (`meeting_url`), so your partner gets it automatically.
2. **Enter Our Call ❤️** first asks the app's server (`/api/meeting/check`) whether the meeting page allows other websites to show it. Browsers silently refuse to show pages that send `X-Frame-Options` or a `frame-ancestors` rule, and a page can't detect that refusal itself.
   - If framing is allowed, the meeting opens **inside the cinema**, with camera and microphone permission and the chat beside it.
   - If the service forbids it, the page says *"Microsoft Teams doesn't allow this meeting to be embedded here."* It then offers **Open Teams** (new tab) and **Open in the Teams app** (`msteams:` link). The cinema, chat and room stay open.
   - If the check can't tell, it tries in-page and always shows a "Not loading? Open Teams" bar.

**What to expect:** Microsoft doesn't support showing normal Teams meeting links inside other websites. Its supported way to put a Teams meeting inside your own web page is **Azure Communication Services (ACS) Teams interoperability**. Google Meet also refuses framing, and Zoom needs its own Meeting SDK. So in practice the honest fallback will show for these links.

### Want the Teams call truly inside the page? (optional, needs Microsoft setup)
That requires building the call with **Azure Communication Services** instead of an iframe:
1. An **Azure subscription** and an **Azure Communication Services** resource (Azure Portal → Create → "Communication Services").
2. The meeting must be scheduled from a **work or school Microsoft 365 account**. ACS can't join *personal* Teams meetings (teams.live.com / Teams free).
3. That Teams organization must allow **anonymous / external users to join meetings** (a setting in the Teams admin center).
4. A server route that uses the ACS connection string (server-only env var) to issue short-lived guest tokens, plus the ACS **UI Library** `CallComposite` (React) in the page, joining with the Teams meeting link.
5. Costs: standard ACS pay-as-you-go for audio/video minutes. There's no extra fee for the Teams interop itself.

Both of you would then join as guests inside the cinema, possibly through the Teams lobby depending on the meeting options.

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

1. Open the site → **Create Private Room** → tap **Ayvon**. The room opens on **💻 Our Call**.
2. Paste your Teams meeting link → **Save Meeting** → **Enter Our Call ❤️**.
3. **Copy Room Link** (bottom bar) → send it to Aksa. She opens it, taps **Aksa**, and sees the same call with no pasting.
4. Chat on the right (below on phones) in either mode.
5. **🎬 Watch** → **Upload Video** → pick an MP4. Progress shows in a slim card (*Uploading video… 72%*) while everything else keeps working. When it finishes you see *Video ready ❤️*. Press ▶ and it plays for both of you.
6. **Logout** clears who you are on this device and returns you to the lobby.

When one of you presses play while the other is in Our Call, the other's player stays silent. A dot on 🎬 Watch shows it's playing; switching joins at the right second.

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
  api/meeting/check/route.ts  can this meeting page be shown inside ours?
components/
  VideoPlayer.tsx             custom player + sync engine
  VideoPicker.tsx             "What are we watching?": Upload / Link / Currently watching
  CallStage.tsx               Our Call: save link, in-page meeting, honest fallback
  UploadProgressCard.tsx      background upload progress / Video ready ❤️
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
