# 🎞️ Our Little Cinema

**Different places. Same movie. Together.**

A small, private website where two people in different countries watch the same video together. When one of you presses play, pause or seek, it happens for both. There is also a little chat, floating reactions and "I'm here ❤️" moments.

Built with **Next.js 14 · TypeScript · Tailwind CSS · Supabase Realtime**.

---

## 1. How it works (architecture)

```
   India (Ayvon)                    Supabase (free tier)                    Italy (Aksa)
 ┌───────────────┐   play/pause/   ┌────────────────────────┐   instant   ┌───────────────┐
 │  Next.js app  │ ─ seek events ─▶│ Realtime channel        │ ──────────▶ │  Next.js app  │
 │  <video>      │ ◀────────────── │  room:<code>            │ ◀────────── │  <video>      │
 │  sync engine  │   presence,     │  • Broadcast (events)   │             │  sync engine  │
 └──────┬────────┘   chat, ❤️      │  • Presence (who's here)│             └──────┬────────┘
        │                          ├────────────────────────┤                    │
        └── save / read state ───▶ │ Postgres                │ ◀── read on join ──┘
                                   │  rooms    (shared state)│
                                   │  messages (chat history)│
                                   └────────────────────────┘
        The video itself streams straight from its source (CDN, your storage, or your own file).
```

**Shared room state** (one row in `rooms`):

| field | meaning |
|---|---|
| `video_url`, `video_title`, `source_type` | what's playing (`library`, `url`, `hls`, or `local` for own copy) |
| `is_playing` | playing or paused |
| `position` | seconds into the video **at the moment `updated_at`** |
| `rate` | playback speed |
| `updated_at` | server-clock time (ms) of the last event |
| `updated_by` | who did it |
| connected users | Supabase **Presence** (live, not stored) |

**The sync engine** (`hooks/useRoom.ts` + `components/VideoPlayer.tsx`):

1. **Events, not streams.** Only `play`, `pause`, `seek`, `change video`, `join` and `leave` go over the network. Nothing is sent every millisecond.
2. **One shared clock.** Each browser measures how far its clock is from the server's, NTP-style (`server_now()` in Postgres, best of 5 round-trips). That cancels out the India↔Italy clock difference and part of the network delay.
3. **Each event says "at server time T, the film was at P seconds and playing."** Every client computes `expected = P + (now − T) × rate`. If Aksa's event takes 180 ms to reach India, Ayvon's player still lands on the right frame.
4. **Drift correction once a second, done locally.** Under 0.15 s: nothing. 0.15–1.2 s: the video plays 6% faster or slower until it catches up, which you won't notice. Over 1.2 s (for example after buffering): it jumps to the right spot.
5. **Joining or reconnecting** reads the row from Postgres, so you land exactly where your partner is.
6. **Last write wins.** If you both press something at the same moment, the newer timestamp wins on both screens.

Tested locally with two browsers, a late joiner, a mobile viewport, a forced offline/online cycle and a server clock skewed by 3 s. Both players stayed within ~0.05 s of each other.

---

## 2. About Netflix, Prime Video, Disney+, Hotstar and others

Those services protect their films with **DRM** (Widevine / FairPlay / PlayReady). Their video can only be decoded inside their own apps or pages, and their terms forbid re-embedding. **No other website can legally load, play or synchronise them**, so this app doesn't try. If you paste such a link, it explains this.

For those films, use the service's own group-watch feature where it exists, or start together on a call.

**What this cinema plays (legally):**

- 🎬 **Free films library.** Four Blender Foundation open movies (Creative Commons): *Sintel, Tears of Steel, Big Buck Bunny, Elephants Dream*.
- 🔗 **Any direct video link you're allowed to watch**: `.mp4`, `.webm`, or `.m3u8` (HLS) from your own storage, public-domain archives (e.g. archive.org), Creative Commons films, or a site's official direct file.
- 📁 **"Our own file".** You both have the same file (a film bought as a DRM-free download, home videos, something you made). Each of you opens **your own copy** on your own device. Nothing is uploaded; only play/pause/time is shared.
- 🏠 **A sample video hosted on your own site** (`/public/videos/sample.mp4`, see §7).

---

## 3. Environment variables

Copy `.env.example` → `.env.local` and fill in:

| variable | where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → *Project URL* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → *anon public* key |
| `NEXT_PUBLIC_PERSON_ONE` | default first name (`Ayvon`) |
| `NEXT_PUBLIC_PERSON_TWO` | default second name (`Aksa`) |

The anon key is designed to be public. The database is locked down so it can only call the room functions (see §8).

---

## 4. Setup (≈ 10 minutes)

**Prerequisites:** Node.js 18.18+ (20 LTS recommended) and a free [Supabase](https://supabase.com) account.

1. **Create a Supabase project.** Pick a region between India and Italy, e.g. **Frankfurt (eu-central-1)** or **Mumbai (ap-south-1)**. Frankfurt is a good middle ground.
2. **Create the database.** Supabase → **SQL Editor** → *New query* → paste all of `supabase/schema.sql` → **Run**.
3. **Check Realtime is allowed for public channels.** Supabase → **Realtime** → *Settings*: make sure **"Allow public access"** is enabled (this is the default). This app uses broadcast + presence on public channels.
4. **Run it:**

   ```bash
   npm install
   cp .env.example .env.local   # then paste your URL + anon key
   npm run dev
   ```

5. Open <http://localhost:3000>. To test sync on one computer, open the room link in a normal window **and** a private window, then pick a different name in each.

---

## 5. Deploy (free, ~5 minutes) on Vercel

1. Push this folder to a **private** GitHub repo.
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import the repo (framework: Next.js, detected automatically).
3. Under **Environment Variables**, add the same four variables from `.env.local`.
4. Click **Deploy**. You'll get a URL like `https://our-little-cinema.vercel.app`.
5. *(Optional)* Add your own domain in Vercel → Settings → Domains.

Netlify, Cloudflare Pages (with the Next.js adapter), or any Node host running `npm run build && npm start` work too.

---

## 6. How the two of you join from India and Italy

1. **Ayvon** (India) opens the website → **Create Private Room**.
2. The room opens with an **invite card**. Tap **Copy link** (or **Share** on a phone) and send it to Aksa on WhatsApp.
3. **Aksa** (Italy) opens the link on her laptop or phone and taps **Aksa** on *Who's watching?*
4. Both of you see **🟢 Together · Synced** and both profile bubbles light up.
5. Either of you taps **Choose a movie** and picks a film.
6. Press ▶. It starts for both of you. Pause, skip or drag the progress bar and the other screen follows.

The link works from anywhere: different countries, Wi-Fi or mobile data, phone or laptop. Both browsers connect to the same Supabase Realtime channel over a secure WebSocket. You can reuse the same room link every time; it remembers the last film, position and chat.

> **Tip:** use headphones and keep a WhatsApp voice call running in the background so it feels like the same sofa. ❤️

---

## 7. Demo / sample video setup

- **Zero setup:** the *Free films* tab streams the Blender films from Google's public sample bucket.
- **Host your own sample:** put any video you have the rights to at `public/videos/sample.mp4`, then choose *Sample video on this site*. Keep it small (Vercel serves static files well up to about 100 MB). To make a quick test file:

  ```bash
  ffmpeg -f lavfi -i testsrc2=size=1280x720:rate=25:duration=120 \
         -f lavfi -i sine=frequency=440:duration=120 \
         -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest public/videos/sample.mp4
  ```

- **Full-length films of your own:** upload them to Supabase Storage (create a **private** bucket and use a signed URL), Cloudflare R2, Bunny.net or Backblaze B2, and paste the direct link in the *Video link* tab. For long films, an HLS `.m3u8` stream starts faster and seeks better than one huge MP4.
- **Formats:** MP4 (H.264 + AAC) plays everywhere. WebM works on all modern browsers except older iPhones. `.mkv` often won't play in browsers, so convert it to MP4 first.

---

## 8. Privacy

- No accounts, no tracking, no analytics. Pages send `noindex` so search engines don't list them.
- Room codes like `k7m2-qx9p-4hdt` have ~59 bits of randomness, so they can't realistically be guessed.
- The database tables have row-level security turned on and no policies, so nobody can list or browse rooms. Everything goes through functions that require the exact room code.
- In "Our own file" mode, the video never leaves your device.
- Optional: uncomment the `pg_cron` block at the bottom of `schema.sql` to auto-delete rooms unused for 60 days.

---

## 9. Project structure

```
app/
  layout.tsx              fonts, metadata (noindex)
  page.tsx                landing page: Create / Join
  room/[code]/page.tsx    Who's watching? → the cinema
components/
  VideoPlayer.tsx         custom player + sync engine + drift correction
  ChatPanel.tsx           chat + reaction buttons
  MoviePicker.tsx         library / link / own-file picker + DRM explanation
  FloatingReactions.tsx   ❤️ Ayvon floating over the video
  RoomBits.tsx            status pill, Me / My Love chips, invite card, toasts, names dialog
  Ambient.tsx, Icons.tsx, SetupNotice.tsx
hooks/
  useRoom.ts              Supabase Realtime: state, presence, chat, reactions, clock
lib/
  clock.ts                NTP-style server clock offset
  videos.ts               film library, URL checks, time formatting
  roomCode.ts, identity.ts, supabase.ts, types.ts
supabase/
  schema.sql              tables + secure RPC functions
```

**Keyboard:** `Space`/`K` play-pause · `←`/`→` 10 s · `F` fullscreen · `M` mute · double-click video for fullscreen.

**Changing names:** set `NEXT_PUBLIC_PERSON_ONE/TWO`, or tap the ✏️ next to *AYVON ❤️ AKSA* in a room. That rename shows for both of you instantly.

---

## 10. Ideas for later

- **YouTube** sync through the YouTube IFrame Player API (legal for videos that allow embedding).
- **Google / Microsoft sign-in** with Supabase Auth (Authentication → Providers), plus a policy that only your two emails can open rooms. Left out of v1 to keep it one-tap simple.
- Subtitles (`.vtt` upload), a voice/video bubble (WebRTC), "watch history", a countdown "3-2-1 ❤️" before play.
