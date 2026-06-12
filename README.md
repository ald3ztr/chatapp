# ArzuDigital Chat

Arkadaşlar arasında kullanılacak, **Instagram DM tarzı, mobil öncelikli** gerçek
zamanlı sohbet web uygulaması.

> **Durum:** Tüm fazlar (0–5) tamamlandı 🎉 — grup sohbeti, PWA (ana ekrana
> eklenebilir), dark/light, ve önceki tüm özellikler. Detaylar aşağıda.

## Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express + Socket.IO |
| Veritabanı | SQLite (better-sqlite3) — *ileriki fazlarda* |
| Dosya yükleme | multer — *ileriki fazlarda* |

## Klasör Yapısı

```
arzudigital/
├── package.json        # Kök: her ikisini birlikte çalıştırma
├── server/             # Backend (Express + Socket.IO)
│   ├── index.js
│   └── uploads/        # ileride yüklenen dosyalar
└── client/             # Frontend (React + Vite + Tailwind)
    └── src/
        ├── App.jsx     # Merhaba Dünya + bağlantı durumu
        ├── socket.js   # Socket.IO client
        └── theme.js    # dark/light altyapısı
```

## Kurulum

Node.js 18+ gereklidir. Kök dizinde:

```bash
npm run install:all
```

Bu komut kök, `server/` ve `client/` bağımlılıklarını tek seferde yükler.

## Çalıştırma

### Tek komutla (önerilen)

Kök dizinde:

```bash
npm run dev
```

Bu, backend ve frontend'i aynı anda başlatır.

### Ayrı ayrı

```bash
# Terminal 1 — backend
npm run dev:server

# Terminal 2 — frontend
npm run dev:client
```

## Portlar

| Servis | Adres |
|--------|-------|
| Frontend (Vite) | http://localhost:5173 |
| Backend (Express + Socket.IO) | http://localhost:3001 |
| Sağlık kontrolü | http://localhost:3001/api/health |

Vite, `/socket.io` ve `/api` isteklerini otomatik olarak backend'e
yönlendirir (proxy), bu yüzden tarayıcıda sadece **http://localhost:5173**
adresini açmanız yeterlidir.

### Çalıştığını nasıl anlarım?

1. Tarayıcıda http://localhost:5173 → **"Merhaba Dünya"** ve yeşil
   **"Sunucuya bağlandı"** rozeti görünür.
2. Tarayıcı konsolunda (F12) **`baglandi`** yazısı görünür.
3. Backend terminalinde **`[socket] baglandi: <id>`** satırı görünür.
4. Sağ üstteki buton ile **koyu/açık tema** arasında geçiş yapılabilir.

### Mobilden test

Vite `host: true` ile çalışır. Telefon ile bilgisayar aynı ağdaysa,
bilgisayarın yerel IP'si üzerinden `http://<IP>:5173` adresinden erişebilirsiniz.

## FAZ 1 — Kimlik (özet)

- **Doğrulama yok:** kullanıcı sadece bir kullanıcı adı (+ opsiyonel profil
  fotoğrafı) ile anında kayıt olur.
- **Kalıcı oturum:** kayıt olunca token `localStorage`'a yazılır; uygulama
  yeniden açıldığında giriş **sorulmadan** otomatik oturum açılır.
- **Profil:** kullanıcı adı, profil fotoğrafı ve durum mesajı düzenlenebilir.
- **Çıkış:** token silinir, kayıt ekranına dönülür.
- Kullanıcılar **SQLite**'a (`server/data/arzudigital.db`) kaydedilir; profil
  fotoğrafları `server/uploads/`'a yüklenir.

### API uçları

| Yöntem | Uç | Açıklama |
|--------|-----|----------|
| `POST` | `/api/register` | `multipart`: `username` (zorunlu), `avatar` (opsiyonel) → `{ token, user }` |
| `GET` | `/api/me` | `Authorization: Bearer <token>` → `{ user }` (otomatik oturum) |
| `PUT` | `/api/me` | `multipart`: `username?`, `status?`, `avatar?` → `{ user }` |

> Kullanıcı adı 2–20 karakter (harf, rakam, nokta, alt çizgi) ve
> büyük/küçük harf duyarsız benzersizdir.

## FAZ 2 — Metin sohbeti (özet)

- **Sohbet listesi:** her sohbet için avatar, son mesaj önizlemesi, zaman ve
  **okunmamış rozeti**. Yeni mesaj geldiğinde liste gerçek zamanlı güncellenir.
- **Birebir mesajlaşma:** Socket.IO ile gerçek zamanlı. Gönderen sağda (mavi),
  alıcı solda (beyaz) baloncuk; zaman damgası ve **gün ayıracı** (Bugün/Dün/tarih).
- **Geçmiş:** mesajlar SQLite'a (`messages` tablosu) kaydedilir, sohbet açılınca
  yüklenir ve karşıdan gelenler okundu işaretlenir.
- **Sabit input bar:** alt tarafta, mobil klavye ve güvenli alan (`safe-area`)
  uyumlu.

### Socket olayları

| Yön | Olay | Açıklama |
|-----|------|----------|
| C→S | `message:send` `{ toUserId, body }` | Mesaj gönder; `ack` ile kaydedilen mesaj döner |
| S→C | `message:new` `{ message, from }` | Alıcıya gerçek zamanlı yeni mesaj |
| S→C | `message:read` `{ by }` | Karşı taraf mesajları okudu (FAZ 4'te UI'ı gelecek) |

Socket bağlantısı el sıkışmada `auth.token` ile doğrulanır.

### Sohbet uçları (REST)

| Yöntem | Uç | Açıklama |
|--------|-----|----------|
| `GET` | `/api/users` | Sohbet başlatmak için diğer kullanıcılar |
| `GET` | `/api/conversations` | Sohbet listesi (son mesaj + okunmamış) |
| `GET` | `/api/messages/:peerId` | Mesaj geçmişi (açılınca okundu işaretlenir) |
| `POST` | `/api/messages/:peerId/read` | Sohbeti okundu işaretle |

## FAZ 3 — Medya (özet)

- **Emoji seçici:** bağımlılıksız, kategorili (yüz, el, kalp, hayvan, yemek,
  aktivite); seçilen emoji mesaj kutusuna eklenir.
- **Fotoğraf:** ataç menüsünden seçilir, multer ile `/uploads`'a kaydedilir,
  sohbette önizlenir; tıklayınca **tam ekran** (lightbox) açılır.
- **Ses:** mikrofondan **kayıt** (MediaRecorder) veya **dosyadan** ses yükleme.
  Mesajda oynat/duraklat + süre + ilerleme çubuğu olan oynatıcı.
- Yüklenen tüm dosyalar `server/uploads/`'a gider; mesaj tipi (`text`/`image`/
  `audio`), medya adresi ve süre SQLite'ta tutulur.

> **Mikrofon notu:** `getUserMedia` yalnızca **HTTPS** veya **localhost**'ta
> çalışır. Telefondan LAN IP'si (`http://...`) ile test ederken mikrofon
> tarayıcı tarafından engellenebilir; bu durumda dosyadan ses yükleme kullanılır.

| Yöntem | Uç | Açıklama |
|--------|-----|----------|
| `POST` | `/api/upload` | Görsel/ses yükle → `{ url, mime, size }` (sonra `message:send` ile gönderilir) |

`message:send` artık `{ toUserId, type, body?, mediaUrl?, durationMs? }` alır
(`type`: `text` \| `image` \| `audio`). Güvenlik için `mediaUrl` yalnızca
sunucunun kendi `/uploads/` yolu olabilir.

## FAZ 4 — Canlı detaylar (özet)

- **"Yazıyor…":** sohbet başlığında karşı taraf yazarken gösterilir.
- **Mesaj durumları:** gönderildi (✓) / iletildi (✓✓) / okundu (renkli ✓✓);
  gönderdiğin mesajların altında ikonla.
- **Çevrimiçi / son görülme:** başlıkta ve sohbet listesinde yeşil nokta;
  çevrimdışıyken "son görülme …".
- **Tepkiler:** mesaja dokun → hızlı emoji çubuğu (❤️😂😮😢👍🔥); baloncukta rozet.
- **Bildirim:** açık olmayan sohbete mesaj gelince kısa ses (WebAudio) + sekme
  başlığında okunmamış sayacı `(N)`.
- **Arama:** üst bardaki arama ile metin mesajlarında arama (vurgulu sonuç).

### Socket olayları (FAZ 4 eklemeleri)

| Yön | Olay | Açıklama |
|-----|------|----------|
| C→S/S→C | `typing` `{ toUserId/from, typing }` | "Yazıyor…" durumu |
| S→C | `presence` / `presence:init` | Çevrimiçi/çevrimdışı + son görülme |
| S→C | `message:delivered` `{ messageId }` | Mesaj alıcıya iletildi |
| C→S | `reaction:set` `{ messageId, emoji }` | Tepki ekle/değiştir/kaldır |
| S→C | `reaction:update` `{ messageId, reactions }` | Tepki güncellemesi |

| Yöntem | Uç | Açıklama |
|--------|-----|----------|
| `GET` | `/api/search?q=` | Metin mesajlarında arama |

## FAZ 5 — Grup, PWA, bitiriş (özet)

- **Grup sohbeti:** grup adı + grup fotoğrafı + birden fazla üye seçerek grup
  oluşturma. Gerçek zamanlı grup mesajlaşması (Socket.IO odaları); her gelen
  mesajda gönderenin avatarı ve adı gösterilir. Metin/emoji/foto/ses ve grupta
  "yazıyor…" göstergesi. Okunmamış sayacı üye bazında tutulur.
- **PWA:** `manifest.webmanifest` + `service worker` (network-first). Telefonun
  ana ekranına eklenip **uygulama gibi** (standalone) açılabilir.
- **Dark/Light:** üst bardaki güneş/ay butonuyla anında geçiş (tercih
  cihazda saklanır).

### Grup uçları / olayları

| Yöntem / Olay | Açıklama |
|---------------|----------|
| `POST /api/groups` | Grup oluştur (multipart: `name`, `memberIds`, `avatar`) |
| `GET /api/groups` | Kullanıcının grupları (son mesaj + okunmamış) |
| `GET /api/groups/:id/messages` | Grup geçmişi + üyeler (açılınca okundu) |
| `group:message:send` / `group:message:new` | Gerçek zamanlı grup mesajı |
| `group:typing` / `group:new` | "Yazıyor…" / yeni gruba eklenme |

## Dağıtım (Deploy)

Uygulama bir **statik frontend** (client) + bir **Node sunucusu** (server,
Socket.IO + SQLite + yüklenen dosyalar) şeklindedir.

### 1. Production build

```bash
npm run build          # client/dist üretilir
```

### 2. Sunucuyu çalıştırma (tek port her şeyi sunar)

Sunucu, `client/dist` varsa otomatik olarak derlenmiş frontend'i de sunar
(API + Socket.IO + statik site + `/uploads` → tek port). Yani:

```bash
npm run build     # client/dist üretir
npm start         # server'ı başlatır; dist'i de sunar (varsayılan port 3001)
```

Tarayıcıda `http://SUNUCU_IP:3001` → uygulama açılır.

### 3. HTTPS (mikrofon ve PWA için zorunlu)

- **Mikrofon** (`getUserMedia`) ve **PWA kurulumu** yalnızca **HTTPS** veya
  `localhost`'ta çalışır. Yayında mutlaka HTTPS kullanın.
- Pratik yol: uygulamayı bir **reverse proxy** (Nginx/Caddy) arkasına alıp TLS
  sertifikası (Let's Encrypt) ile sunun. Caddy ile otomatik HTTPS örneği:

  ```
  ornek-alan-adi.com {
      reverse_proxy localhost:3001
  }
  ```

### 4. Platform seçenekleri

- **Tek VPS / sunucu:** yukarıdaki gibi `server` + `client/dist` + Caddy/Nginx.
- **Ayrı barındırma:** frontend'i statik bir hosta (Netlify/Vercel/Cloudflare
  Pages) atıp, `vite.config.js`'deki proxy yerine `VITE_API_URL` ile backend
  adresini verin; backend'i (Render/Railway/Fly.io/VPS) WebSocket destekli bir
  yere koyun. **CORS** ayarını (`CLIENT_ORIGIN`) frontend alan adına göre
  güncelleyin.
- **Kalıcılık:** SQLite dosyası (`server/data/`) ve yüklenenler
  (`server/uploads/`) kalıcı diskte tutulmalı (container'larda volume bağlayın).

### Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
|----------|-----------|----------|
| `PORT` | `3001` | Backend portu |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS izinli frontend kaynağı |

## Test Checklist

Yayına almadan önce elle doğrulama listesi:

**Kimlik (FAZ 1)**
- [ ] Kullanıcı adıyla (foto opsiyonel) anında kayıt
- [ ] Sayfa yenilenince giriş sorulmadan otomatik oturum
- [ ] Profil düzenleme (ad/foto/durum) kaydediliyor ve kalıcı
- [ ] Çıkış yapınca kayıt ekranına dönüyor

**Metin sohbeti (FAZ 2)**
- [ ] İki cihaz/sekme arasında gerçek zamanlı mesajlaşma
- [ ] Sohbet listesinde son mesaj + zaman + okunmamış rozeti
- [ ] Baloncuklar (sağ/sol), gün ayıracı, geçmiş yükleniyor

**Medya (FAZ 3)**
- [ ] Emoji seçici → mesaja ekleniyor
- [ ] Fotoğraf gönderme + tıklayınca tam ekran
- [ ] Mikrofonla ses kaydı + dosyadan ses; oynatıcı çalışıyor (HTTPS/localhost)

**Canlı detaylar (FAZ 4)**
- [ ] "Yazıyor…" göstergesi
- [ ] Mesaj durumu: gönderildi → iletildi → okundu
- [ ] Çevrimiçi noktası / "son görülme"
- [ ] Mesaja emoji tepki; baloncukta rozet
- [ ] Yeni mesajda bildirim sesi + sekme başlığı sayacı
- [ ] Mesaj arama (Türkçe büyük/küçük harf dahil)

**Grup & PWA (FAZ 5)**
- [ ] Grup oluşturma (ad + foto + üyeler)
- [ ] Grupta gerçek zamanlı mesaj; gönderen adı/avatarı görünüyor
- [ ] Grup listede görünüyor, okunmamış sayacı çalışıyor
- [ ] PWA: telefonda "Ana ekrana ekle" → uygulama gibi açılıyor (HTTPS)
- [ ] Dark/Light geçişi ve tercih hatırlanıyor
- [ ] Mobilde input bar klavye açılınca düzgün

## Yol Haritası

- [x] **FAZ 0** — Kurulum ve iskelet
- [x] **FAZ 1** — Kayıt + kalıcı oturum, profil
- [x] **FAZ 2** — Birebir metin sohbeti
- [x] **FAZ 3** — Emoji, fotoğraf, ses
- [x] **FAZ 4** — Yazıyor / okundu / online, tepkiler, arama
- [x] **FAZ 5** — Grup, PWA, son rötuş
