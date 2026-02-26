# Flag Forge

Realtime YouTube Live chat → game overlay. Chat messages spawn moving flags with weapons, bullets, and a leaderboard. The overlay is built with Next.js + Colyseus and is ready to be used as an OBS browser source.

## Fitur Utama

- Realtime spawn dari YouTube Live Chat
- Bendera bergerak, menembak, dan collision sederhana
- Leaderboard per negara
- Overlay responsif untuk OBS
- Batas jumlah bendera aktif + antrean untuk menjaga performa
- **Custom Flag Support**: Mendukung gambar bendera custom atau otomatis dari CDN.

## Teknologi

- Next.js (app router)
- Colyseus (server WebSocket)
- Tone.js (audio)

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Open http://localhost:3000 (akan redirect ke /overlay).

## Konfigurasi Environment

Buat file `.env` lalu isi salah satu opsi berikut:

Minimal (pakai videoId):

```
YOUTUBE_API_KEY=YOUR_KEY
YOUTUBE_VIDEO_ID=LIVE_VIDEO_ID
```

Atau langsung liveChatId:

```
YOUTUBE_API_KEY=YOUR_KEY
YOUTUBE_LIVE_CHAT_ID=LIVE_CHAT_ID
```

Opsional:

```
YOUTUBE_POLL_INTERVAL_MS=5000
PORT=3000
```

## Cara Pakai

1. Pastikan live stream sudah berjalan.
2. Set `.env` sesuai konfigurasi di atas.
3. Jalankan `npm run dev`.
4. Buka `/overlay` di browser atau OBS Browser Source.
5. Chat masuk akan dimasukkan antrean dan spawn bertahap.

## Custom Flag Images

Secara default, aplikasi akan mencoba memuat gambar bendera dari CDN (`flagcdn.com`) jika input adalah kode negara 2 huruf (contoh: ID, US, JP).

Jika Anda memiliki gambar bendera sendiri (misal untuk komunitas tertentu atau nama negara lengkap):
1. Buat folder `flags` di dalam folder `public` (`public/flags/`).
2. Simpan file gambar **.png** di folder tersebut.
3. Beri nama file sesuai dengan teks yang dikirim di chat (huruf kecil).
   - Contoh: Jika user mengetik "Indo", simpan sebagai `public/flags/indo.png`.
   - Contoh: Jika user mengetik "MyCommunity", simpan sebagai `public/flags/mycommunity.png`.
4. Aplikasi akan memprioritaskan file lokal ini. Jika tidak ditemukan, akan mencoba CDN (jika 2 huruf) atau menampilkan teks.

## Pengaturan Performa (Server)

Konfigurasi ini ada di `src/game/FlagRoom.ts`:

- `maxActiveFlags` membatasi jumlah bendera aktif
- `maxQueueSize` membatasi antrean chat
- `spawnRatePerSecond` membatasi kecepatan spawn

## Catatan

- YouTube Data API v3 wajib diaktifkan di project GCP.
- Chat hanya tersedia saat live stream aktif.
