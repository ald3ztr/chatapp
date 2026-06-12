// ArzuDigital Chat - Backend (FAZ 2)
// Express + Socket.IO. FAZ 1: kimlik. FAZ 2: birebir gercek zamanli metin sohbeti.

import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import {
  usersRepo, messagesRepo, groupsRepo,
  publicUser, publicMessage, publicGroup, publicGroupMessage,
} from './db.js';
import { uploadAvatar, uploadMedia, UPLOADS_DIR } from './upload.js';

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Yuklenen dosyalari statik sun (profil fotograflari vb.)
app.use('/uploads', express.static(UPLOADS_DIR));

// Saglik kontrolu
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', phase: 1, time: new Date().toISOString() });
});

// multer'i Promise ile sarmala (hata yonetimi icin)
function runUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadAvatar(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

const USERNAME_RE = /^[a-zA-Z0-9._]{2,20}$/;

function normalizeUsername(raw) {
  return (raw || '').trim();
}

// --- Kayit: dogrulama yok, kullanici adi (+ opsiyonel foto) ile aninda ---
app.post('/api/register', async (req, res) => {
  try {
    await runUpload(req, res);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const username = normalizeUsername(req.body.username);
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'Kullanici adi 2-20 karakter olmali; harf, rakam, nokta ve alt cizgi icerebilir.',
    });
  }
  if (usersRepo.findByUsername(username)) {
    return res.status(409).json({ error: 'Bu kullanici adi zaten alinmis.' });
  }

  const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const row = usersRepo.create({
    id: randomUUID(),
    username,
    token: randomUUID(),
    avatarUrl,
  });

  // Token + kullanici don (istemci token'i localStorage'a yazacak)
  res.status(201).json({ token: row.token, user: publicUser(row) });
});

// --- Token'dan kullaniciyi bul (otomatik oturum) ---
function authFromToken(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-token');
  if (!token) return null;
  return usersRepo.findByToken(token);
}

// --- Otomatik oturum: token gecerliyse kullaniciyi don ---
app.get('/api/me', (req, res) => {
  const row = authFromToken(req);
  if (!row) return res.status(401).json({ error: 'Gecersiz veya eksik oturum.' });
  res.json({ user: publicUser(row) });
});

// --- Profil guncelle: kullanici adi, durum mesaji, profil fotografi ---
app.put('/api/me', async (req, res) => {
  const current = authFromToken(req);
  if (!current) return res.status(401).json({ error: 'Gecersiz veya eksik oturum.' });

  try {
    await runUpload(req, res);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Gonderilmeyen alanlar mevcut degerini korur
  const username =
    req.body.username !== undefined ? normalizeUsername(req.body.username) : current.username;
  const status = req.body.status !== undefined ? String(req.body.status).slice(0, 140) : current.status;

  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'Kullanici adi 2-20 karakter olmali; harf, rakam, nokta ve alt cizgi icerebilir.',
    });
  }
  const clash = usersRepo.findByUsername(username);
  if (clash && clash.id !== current.id) {
    return res.status(409).json({ error: 'Bu kullanici adi zaten alinmis.' });
  }

  const avatarUrl = req.file ? `/uploads/${req.file.filename}` : current.avatar_url;
  const row = usersRepo.update({ id: current.id, username, status, avatarUrl });
  res.json({ user: publicUser(row) });
});

// Route'lar icin kimlik araci
function requireAuth(req, res, next) {
  const row = authFromToken(req);
  if (!row) return res.status(401).json({ error: 'Gecersiz veya eksik oturum.' });
  req.user = row;
  next();
}

// --- Sohbet baslatmak icin kullanici listesi (FAZ 2) ---
app.get('/api/users', requireAuth, (req, res) => {
  res.json({ users: usersRepo.listExcept(req.user.id).map(publicUser) });
});

// --- Sohbet listesi: partner + son mesaj + okunmamis sayisi ---
app.get('/api/conversations', requireAuth, (req, res) => {
  res.json({ conversations: messagesRepo.conversations(req.user.id) });
});

// --- Bir kullaniciyla mesaj gecmisi (acilinca okundu isaretlenir) ---
app.get('/api/messages/:peerId', requireAuth, (req, res) => {
  const peer = usersRepo.findById(req.params.peerId);
  if (!peer) return res.status(404).json({ error: 'Kullanici bulunamadi.' });

  const rows = messagesRepo.thread(req.user.id, peer.id);
  // Acilinca: peer'dan gelenleri okundu yap, peer cevrimiciyse haber ver
  const changed = messagesRepo.markRead(req.user.id, peer.id);
  if (changed) emitToUser(peer.id, 'message:read', { by: req.user.id });

  res.json({ peer: publicUser(peer), messages: rows });
});

// --- Bir sohbeti okundu isaretle (sohbet acikken canli mesaj gelince) ---
app.post('/api/messages/:peerId/read', requireAuth, (req, res) => {
  const changed = messagesRepo.markRead(req.user.id, req.params.peerId);
  if (changed) emitToUser(req.params.peerId, 'message:read', { by: req.user.id });
  res.json({ ok: true });
});

// --- FAZ 5: Grup olustur (multipart: name, memberIds, avatar) ---
app.post('/api/groups', requireAuth, (req, res) => {
  uploadAvatar(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const name = String(req.body.name || '').trim().slice(0, 40);
    if (name.length < 2) return res.status(400).json({ error: 'Grup adi en az 2 karakter olmali.' });

    // memberIds: virgulle ayrilmis id listesi
    const memberIds = String(req.body.memberIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter((id) => id && usersRepo.findById(id));
    if (memberIds.length < 1) return res.status(400).json({ error: 'En az bir uye secmelisin.' });

    const avatarUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const row = groupsRepo.create({
      id: randomUUID(), name, avatarUrl, createdBy: req.user.id, memberIds,
    });
    const group = publicGroup(row, groupsRepo.members(row.id));

    // Uyelerin acik soketlerini gruba kat + bilgilendir
    for (const m of group.members) {
      joinUserToGroup(m.id, group.id);
      emitToUser(m.id, 'group:new', { group });
    }
    res.status(201).json({ group });
  });
});

// --- Kullanicinin gruplari ---
app.get('/api/groups', requireAuth, (req, res) => {
  res.json({ groups: groupsRepo.listForUser(req.user.id) });
});

// --- Grup mesaj gecmisi (acilinca okundu) ---
app.get('/api/groups/:id/messages', requireAuth, (req, res) => {
  const g = groupsRepo.byId(req.params.id);
  if (!g || !groupsRepo.isMember(g.id, req.user.id))
    return res.status(404).json({ error: 'Grup bulunamadi.' });
  const group = publicGroup(g, groupsRepo.members(g.id));
  const messages = groupsRepo.thread(g.id);
  groupsRepo.markRead(g.id, req.user.id);
  res.json({ group, messages });
});

// --- Mesaj arama (FAZ 4): metin mesajlarinda ara, partner bilgisiyle don ---
app.get('/api/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  const me = req.user.id;
  const results = messagesRepo.search(me, q).map((m) => {
    const partnerId = m.senderId === me ? m.receiverId : m.senderId;
    return { message: m, partner: publicUser(usersRepo.findById(partnerId)), mine: m.senderId === me };
  });
  res.json({ results });
});

// --- Medya yukleme (FAZ 3): gorsel veya ses → { url, mime } ---
app.post('/api/upload', requireAuth, (req, res) => {
  uploadMedia(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Dosya bulunamadi.' });
    res.json({
      url: `/uploads/${req.file.filename}`,
      mime: req.file.mimetype,
      size: req.file.size,
    });
  });
});

// --- Production: derlenmis frontend'i (client/dist) ayni sunucudan sun ---
// Boylece VPS'te tek surec/tek port hem API'yi hem siteyi sunar.
const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'client', 'dist');
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback: API/uploads disindaki tum yollar index.html'e (React yonlendirmesi)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(join(DIST_DIR, 'index.html'));
  });
  console.log('[server] client/dist bulundu, frontend ayni sunucudan sunuluyor');
}

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  // Production'da ayni origin'den sunuldugu icin CLIENT_ORIGIN'i kendi alan adina ayarla
  cors: { origin: CLIENT_ORIGIN, methods: ['GET', 'POST'] },
});

// userId -> baglanti id'leri (bir kullanici birden fazla sekme/cihaz acabilir)
const online = new Map();
function addSocket(userId, socketId) {
  if (!online.has(userId)) online.set(userId, new Set());
  online.get(userId).add(socketId);
}
function removeSocket(userId, socketId) {
  const set = online.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) online.delete(userId);
}
function emitToUser(userId, event, payload) {
  const set = online.get(userId);
  if (!set) return;
  for (const sid of set) io.to(sid).emit(event, payload);
}
function isOnline(userId) {
  return online.has(userId);
}
// Bir kullanicinin tum acik soketlerini grup odasina kat
function joinUserToGroup(userId, groupId) {
  const set = online.get(userId);
  if (!set) return;
  for (const sid of set) io.sockets.sockets.get(sid)?.join(`group:${groupId}`);
}
// Presence degisimini herkese duyur (arkadas uygulamasi olcegi)
function broadcastPresence(userId, isUp, lastSeen) {
  io.emit('presence', { userId, online: isUp, lastSeen: lastSeen || null });
}

// Socket kimlik dogrulama: el sikismada token bekle
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const user = token ? usersRepo.findByToken(token) : null;
  if (!user) return next(new Error('unauthorized'));
  socket.data.user = publicUser(user);
  next();
});

io.on('connection', (socket) => {
  const me = socket.data.user;
  const wasOffline = !isOnline(me.id);
  addSocket(me.id, socket.id);
  console.log(`[socket] baglandi: ${me.username} (${socket.id})`);

  // Yeni baglanan sokete o an cevrimici olanlarin listesini gonder
  socket.emit('presence:init', { online: [...online.keys()] });

  // Uyesi oldugu tum gruplarin odalarina kat
  for (const gid of groupsRepo.groupIdsForUser(me.id)) socket.join(`group:${gid}`);

  // Grup mesaji gonder: kaydet, oda uyelerine ilet
  socket.on('group:message:send', (payload, ack) => {
    try {
      const groupId = String(payload?.groupId || '');
      if (!groupsRepo.isMember(groupId, me.id)) return ack?.({ error: 'Grup uyesi degilsin.' });

      const type = ['text', 'image', 'audio'].includes(payload?.type) ? payload.type : 'text';
      const body = String(payload?.body || '').trim().slice(0, 4000);
      const mediaUrl = payload?.mediaUrl ? String(payload.mediaUrl) : null;
      const durationMs = Number.isFinite(payload?.durationMs) ? Math.round(payload.durationMs) : null;
      if (type === 'text' && !body) return ack?.({ error: 'Bos mesaj.' });
      if (type !== 'text' && !mediaUrl) return ack?.({ error: 'Medya adresi eksik.' });
      if (mediaUrl && !mediaUrl.startsWith('/uploads/')) return ack?.({ error: 'Gecersiz medya adresi.' });

      const row = groupsRepo.addMessage({
        id: randomUUID(), groupId, senderId: me.id, body, type, mediaUrl, durationMs,
      });
      const message = publicGroupMessage(row);
      // Oda uyelerine ilet (gonderen dahil degil; gonderen ack ile alir)
      socket.to(`group:${groupId}`).emit('group:message:new', { message, from: me });
      ack?.({ message });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Grupta "yaziyor..." (gonderen disindaki uyelere)
  socket.on('group:typing', ({ groupId, typing }) => {
    if (groupId && groupsRepo.isMember(String(groupId), me.id))
      socket.to(`group:${groupId}`).emit('group:typing', { groupId, from: me, typing: !!typing });
  });

  // --- Sesli/goruntulu arama sinyallesmesi (WebRTC) ---
  // Sunucu yalnizca offer/answer/ICE mesajlarini iki kullanici arasinda tasir.
  socket.on('call:invite', ({ toUserId, callType, offer }) => {
    if (!isOnline(String(toUserId))) return socket.emit('call:unavailable', { toUserId });
    const type = callType === 'video' ? 'video' : 'audio';
    emitToUser(String(toUserId), 'call:incoming', { from: me, callType: type, offer });
  });
  socket.on('call:accept', ({ toUserId, answer }) => {
    emitToUser(String(toUserId), 'call:accepted', { from: me, answer });
  });
  socket.on('call:reject', ({ toUserId }) => {
    emitToUser(String(toUserId), 'call:rejected', { from: me.id });
  });
  socket.on('call:cancel', ({ toUserId }) => {
    emitToUser(String(toUserId), 'call:cancelled', { from: me.id });
  });
  socket.on('call:ice', ({ toUserId, candidate }) => {
    emitToUser(String(toUserId), 'call:ice', { from: me.id, candidate });
  });
  socket.on('call:end', ({ toUserId }) => {
    emitToUser(String(toUserId), 'call:ended', { from: me.id });
  });

  if (wasOffline) {
    // Ilk baglanti: herkese cevrimici oldugunu duyur
    broadcastPresence(me.id, true);
    // Cevrimdisiyken gelen mesajlari iletildi isaretle, gonderenlere haber ver
    for (const { id, senderId } of messagesRepo.undeliveredFor(me.id)) {
      if (messagesRepo.markDelivered(id)) {
        emitToUser(senderId, 'message:delivered', { messageId: id });
      }
    }
  }

  // "Yaziyor..." gostergesi: karsi tarafa ilet
  socket.on('typing', ({ toUserId, typing }) => {
    if (toUserId) emitToUser(String(toUserId), 'typing', { from: me.id, typing: !!typing });
  });

  // Mesaja tepki (emoji): ekle/degistir/kaldir, iki tarafa da bildir
  socket.on('reaction:set', ({ messageId, emoji }, ack) => {
    try {
      const msg = messagesRepo.byId(String(messageId || ''));
      if (!msg) return ack?.({ error: 'Mesaj bulunamadi.' });
      // Sadece bu sohbetin taraflari tepki verebilir
      if (msg.sender_id !== me.id && msg.receiver_id !== me.id) {
        return ack?.({ error: 'Yetkisiz.' });
      }
      const safeEmoji = emoji ? String(emoji).slice(0, 8) : null;
      const reactions = messagesRepo.setReaction(msg.id, me.id, safeEmoji);
      const peerId = msg.sender_id === me.id ? msg.receiver_id : msg.sender_id;
      emitToUser(peerId, 'reaction:update', { messageId: msg.id, reactions });
      ack?.({ reactions });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  // Mesaj gonder: kaydet, alana ilet, gonderene onayla
  socket.on('message:send', (payload, ack) => {
    try {
      const toUserId = String(payload?.toUserId || '');
      const type = ['text', 'image', 'audio'].includes(payload?.type) ? payload.type : 'text';
      const body = String(payload?.body || '').trim().slice(0, 4000);
      const mediaUrl = payload?.mediaUrl ? String(payload.mediaUrl) : null;
      const durationMs = Number.isFinite(payload?.durationMs) ? Math.round(payload.durationMs) : null;

      // Metin mesaji govde ister; medya mesaji mediaUrl ister
      if (type === 'text' && !body) return ack?.({ error: 'Bos mesaj.' });
      if (type !== 'text' && !mediaUrl) return ack?.({ error: 'Medya adresi eksik.' });
      // Guvenlik: mediaUrl sadece kendi /uploads yolumuz olabilir
      if (mediaUrl && !mediaUrl.startsWith('/uploads/')) {
        return ack?.({ error: 'Gecersiz medya adresi.' });
      }

      const peer = usersRepo.findById(toUserId);
      if (!peer) return ack?.({ error: 'Alici bulunamadi.' });

      const row = messagesRepo.create({
        id: randomUUID(),
        senderId: me.id,
        receiverId: peer.id,
        body,
        type,
        mediaUrl,
        durationMs,
      });
      let msg = publicMessage(row);

      // Alici cevrimiciyse aninda iletildi say
      if (isOnline(peer.id) && messagesRepo.markDelivered(row.id)) {
        msg = publicMessage(messagesRepo.byId(row.id));
      }

      // Aliciya gercek zamanli ilet
      emitToUser(peer.id, 'message:new', { message: msg, from: me });
      // Gonderene onay (optimistik mesaji gercegiyle degistirmek icin)
      ack?.({ message: msg });
    } catch (err) {
      ack?.({ error: err.message });
    }
  });

  socket.on('disconnect', (reason) => {
    removeSocket(me.id, socket.id);
    console.log(`[socket] baglanti kesildi: ${me.username} (${reason})`);
    // Kullanicinin son baglantisi da koptuysa: son gorulme + cevrimdisi duyurusu
    if (!isOnline(me.id)) {
      const ts = Date.now();
      usersRepo.setLastSeen(me.id, ts);
      broadcastPresence(me.id, false, ts);
    }
  });
});

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} adresinde calisiyor`);
  console.log(`[server] Socket.IO hazir, CORS kaynagi: ${CLIENT_ORIGIN}`);
});
