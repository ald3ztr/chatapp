// SQLite veritabani katmani (FAZ 1)
// better-sqlite3 ile users tablosu. Sonraki fazlarda mesajlar/gruplar eklenecek.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'arzudigital.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    avatar_url  TEXT,
    status      TEXT,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  -- Kullanici adi buyuk/kucuk harf duyarsiz benzersiz olsun
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase
    ON users (username COLLATE NOCASE);

  -- Birebir mesajlar (FAZ 2)
  CREATE TABLE IF NOT EXISTS messages (
    id           TEXT PRIMARY KEY,
    sender_id    TEXT NOT NULL,
    receiver_id  TEXT NOT NULL,
    body         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    read_at      INTEGER,
    FOREIGN KEY (sender_id)   REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_messages_pair
    ON messages (sender_id, receiver_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON messages (receiver_id, read_at);
`);

// FAZ 3: mevcut messages tablosuna medya alanlarini ekle (varsa atla)
{
  const cols = db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
  if (!cols.includes('type'))
    db.exec("ALTER TABLE messages ADD COLUMN type TEXT NOT NULL DEFAULT 'text'");
  if (!cols.includes('media_url')) db.exec('ALTER TABLE messages ADD COLUMN media_url TEXT');
  if (!cols.includes('duration_ms'))
    db.exec('ALTER TABLE messages ADD COLUMN duration_ms INTEGER');
  // FAZ 4: iletildi zamani
  if (!cols.includes('delivered_at')) db.exec('ALTER TABLE messages ADD COLUMN delivered_at INTEGER');
}

// FAZ 4: kullanicilara son gorulme alani
{
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols.includes('last_seen')) db.exec('ALTER TABLE users ADD COLUMN last_seen INTEGER');
  // FAZ 6: 4 haneli PIN (salt:hash olarak saklanir)
  if (!cols.includes('pin_hash')) db.exec('ALTER TABLE users ADD COLUMN pin_hash TEXT');
}

// FAZ 6: mesaja yanit (alintilanan mesajin id'si)
{
  const cols = db.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
  if (!cols.includes('reply_to')) db.exec('ALTER TABLE messages ADD COLUMN reply_to TEXT');
}

// FAZ 4: mesaj tepkileri (kullanici basina bir emoji)
db.exec(`
  CREATE TABLE IF NOT EXISTS reactions (
    message_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    emoji       TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id)    REFERENCES users(id)
  );
`);

// FAZ 5: grup sohbeti
db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    avatar_url  TEXT,
    created_by  TEXT NOT NULL,
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_members (
    group_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    last_read_at INTEGER NOT NULL DEFAULT 0,
    joined_at    INTEGER NOT NULL,
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS group_messages (
    id          TEXT PRIMARY KEY,
    group_id    TEXT NOT NULL,
    sender_id   TEXT NOT NULL,
    body        TEXT,
    type        TEXT NOT NULL DEFAULT 'text',
    media_url   TEXT,
    duration_ms INTEGER,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );

  CREATE INDEX IF NOT EXISTS idx_group_messages ON group_messages (group_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id);
`);

// --- Sorgular ---
const stmts = {
  insertUser: db.prepare(`
    INSERT INTO users (id, username, token, avatar_url, status, pin_hash, created_at, updated_at)
    VALUES (@id, @username, @token, @avatar_url, @status, @pin_hash, @created_at, @updated_at)
  `),
  setPin: db.prepare('UPDATE users SET pin_hash = @pin_hash, updated_at = @updated_at WHERE id = @id'),
  byToken: db.prepare('SELECT * FROM users WHERE token = ?'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  byUsername: db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE'),
  updateProfile: db.prepare(`
    UPDATE users
       SET username = @username,
           status = @status,
           avatar_url = @avatar_url,
           updated_at = @updated_at
     WHERE id = @id
  `),
  allUsersExcept: db.prepare(
    'SELECT * FROM users WHERE id != ? ORDER BY username COLLATE NOCASE'
  ),

  // --- Mesajlar (FAZ 2) ---
  insertMessage: db.prepare(`
    INSERT INTO messages (id, sender_id, receiver_id, body, type, media_url, duration_ms, reply_to, created_at, read_at)
    VALUES (@id, @sender_id, @receiver_id, @body, @type, @media_url, @duration_ms, @reply_to, @created_at, NULL)
  `),
  messageById: db.prepare('SELECT * FROM messages WHERE id = ?'),
  // Iki kullanici arasindaki gecmis (eskiden yeniye)
  thread: db.prepare(`
    SELECT * FROM messages
     WHERE (sender_id = @a AND receiver_id = @b)
        OR (sender_id = @b AND receiver_id = @a)
     ORDER BY created_at ASC, id ASC
  `),
  // Her sohbet icin son mesaj (pencere fonksiyonu ile)
  lastPerPartner: db.prepare(`
    SELECT id, partner_id, body, type, sender_id, receiver_id, created_at, read_at FROM (
      SELECT
        id, body, type, sender_id, receiver_id, created_at, read_at,
        CASE WHEN sender_id = @me THEN receiver_id ELSE sender_id END AS partner_id,
        ROW_NUMBER() OVER (
          PARTITION BY CASE WHEN sender_id = @me THEN receiver_id ELSE sender_id END
          ORDER BY created_at DESC, id DESC
        ) AS rn
      FROM messages
      WHERE sender_id = @me OR receiver_id = @me
    ) WHERE rn = 1
    ORDER BY created_at DESC
  `),
  // Gonderene gore okunmamis sayilari
  unreadCounts: db.prepare(`
    SELECT sender_id AS partner_id, COUNT(*) AS unread
      FROM messages
     WHERE receiver_id = @me AND read_at IS NULL
     GROUP BY sender_id
  `),
  // Bir kullanicidan gelen mesajlari okundu isaretle, etkilenen id'leri don
  markReadFrom: db.prepare(`
    UPDATE messages SET read_at = @now
     WHERE receiver_id = @me AND sender_id = @peer AND read_at IS NULL
  `),
  // FAZ 4: tek bir mesaji iletildi isaretle
  markDelivered: db.prepare(`
    UPDATE messages SET delivered_at = @now
     WHERE id = @id AND delivered_at IS NULL
  `),
  lastSeenUpdate: db.prepare('UPDATE users SET last_seen = @ts WHERE id = @id'),
  undeliveredFor: db.prepare(
    'SELECT id, sender_id FROM messages WHERE receiver_id = ? AND delivered_at IS NULL'
  ),
  // FAZ 4: tepkiler
  upsertReaction: db.prepare(`
    INSERT INTO reactions (message_id, user_id, emoji) VALUES (@message_id, @user_id, @emoji)
    ON CONFLICT(message_id, user_id) DO UPDATE SET emoji = @emoji
  `),
  deleteReaction: db.prepare('DELETE FROM reactions WHERE message_id = @message_id AND user_id = @user_id'),
  reactionsForMessage: db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id = ?'),
  reactionsForThread: db.prepare(`
    SELECT r.message_id, r.user_id, r.emoji
      FROM reactions r
      JOIN messages m ON m.id = r.message_id
     WHERE (m.sender_id = @a AND m.receiver_id = @b)
        OR (m.sender_id = @b AND m.receiver_id = @a)
  `),
  // FAZ 4: kullanicinin dahil oldugu metin mesajlari (arama JS'te yapilir)
  textMessagesFor: db.prepare(`
    SELECT * FROM messages
     WHERE (sender_id = @me OR receiver_id = @me)
       AND type = 'text'
     ORDER BY created_at DESC
     LIMIT 1000
  `),

  // --- FAZ 5: gruplar ---
  insertGroup: db.prepare(`
    INSERT INTO groups (id, name, avatar_url, created_by, created_at)
    VALUES (@id, @name, @avatar_url, @created_by, @created_at)
  `),
  groupById: db.prepare('SELECT * FROM groups WHERE id = ?'),
  addMember: db.prepare(`
    INSERT OR IGNORE INTO group_members (group_id, user_id, last_read_at, joined_at)
    VALUES (@group_id, @user_id, 0, @joined_at)
  `),
  membersOf: db.prepare(`
    SELECT u.* FROM group_members gm JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ? ORDER BY u.username COLLATE NOCASE
  `),
  isMember: db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'),
  groupIdsForUser: db.prepare('SELECT group_id FROM group_members WHERE user_id = ?'),
  insertGroupMessage: db.prepare(`
    INSERT INTO group_messages (id, group_id, sender_id, body, type, media_url, duration_ms, created_at)
    VALUES (@id, @group_id, @sender_id, @body, @type, @media_url, @duration_ms, @created_at)
  `),
  groupMessageById: db.prepare('SELECT * FROM group_messages WHERE id = ?'),
  groupThread: db.prepare(
    'SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC, id ASC LIMIT 500'
  ),
  lastGroupMessage: db.prepare(
    'SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at DESC, id DESC LIMIT 1'
  ),
  groupUnread: db.prepare(`
    SELECT COUNT(*) AS n FROM group_messages
     WHERE group_id = @gid AND sender_id != @me AND created_at > @lastRead
  `),
  memberRow: db.prepare('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?'),
  setGroupRead: db.prepare(
    'UPDATE group_members SET last_read_at = @now WHERE group_id = @gid AND user_id = @me'
  ),
};

// Istemciye gonderilecek guvenli kullanici nesnesi (token haric)
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeen: row.last_seen || null,
    hasPin: !!row.pin_hash,
  };
}

// Istemciye gonderilecek mesaj nesnesi
export function publicMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    body: row.body,
    type: row.type || 'text',
    mediaUrl: row.media_url || null,
    durationMs: row.duration_ms || null,
    replyTo: row.reply_to || null,
    createdAt: row.created_at,
    readAt: row.read_at,
    deliveredAt: row.delivered_at || null,
  };
}

export const usersRepo = {
  create({ id, username, token, avatarUrl = null, status = null, pinHash = null }) {
    const now = Date.now();
    stmts.insertUser.run({
      id,
      username,
      token,
      avatar_url: avatarUrl,
      status,
      pin_hash: pinHash,
      created_at: now,
      updated_at: now,
    });
    return stmts.byId.get(id);
  },
  setPin(id, pinHash) {
    stmts.setPin.run({ id, pin_hash: pinHash, updated_at: Date.now() });
    return stmts.byId.get(id);
  },
  findByToken(token) {
    return stmts.byToken.get(token);
  },
  findByUsername(username) {
    return stmts.byUsername.get(username);
  },
  update({ id, username, status, avatarUrl }) {
    stmts.updateProfile.run({
      id,
      username,
      status,
      avatar_url: avatarUrl,
      updated_at: Date.now(),
    });
    return stmts.byId.get(id);
  },
  findById(id) {
    return stmts.byId.get(id);
  },
  listExcept(id) {
    return stmts.allUsersExcept.all(id);
  },
  setLastSeen(id, ts) {
    stmts.lastSeenUpdate.run({ id, ts });
  },
};

export const messagesRepo = {
  create({ id, senderId, receiverId, body = '', type = 'text', mediaUrl = null, durationMs = null, replyTo = null }) {
    stmts.insertMessage.run({
      id,
      sender_id: senderId,
      receiver_id: receiverId,
      body,
      type,
      media_url: mediaUrl,
      duration_ms: durationMs,
      reply_to: replyTo,
      created_at: Date.now(),
    });
    return stmts.messageById.get(id);
  },
  thread(a, b) {
    const rows = stmts.thread.all({ a, b }).map(publicMessage);
    // Tepkileri mesajlara ekle
    const reacts = stmts.reactionsForThread.all({ a, b });
    const byMsg = new Map();
    for (const r of reacts) {
      if (!byMsg.has(r.message_id)) byMsg.set(r.message_id, []);
      byMsg.get(r.message_id).push({ userId: r.user_id, emoji: r.emoji });
    }
    return rows.map((m) => ({ ...m, reactions: byMsg.get(m.id) || [] }));
  },
  byId(id) {
    return stmts.messageById.get(id);
  },
  markDelivered(id) {
    return stmts.markDelivered.run({ id, now: Date.now() }).changes > 0;
  },
  undeliveredFor(receiverId) {
    return stmts.undeliveredFor.all(receiverId).map((r) => ({ id: r.id, senderId: r.sender_id }));
  },
  search(me, q) {
    // Turkce duyarli kucuk-harf ile esleme (SQLite LIKE Turkce harfleri katlamaz)
    const needle = q.toLocaleLowerCase('tr');
    const rows = stmts.textMessagesFor.all({ me });
    const matches = [];
    for (const row of rows) {
      if ((row.body || '').toLocaleLowerCase('tr').includes(needle)) {
        matches.push(publicMessage(row));
        if (matches.length >= 50) break;
      }
    }
    return matches;
  },
  // Tepki ekle/degistir/kaldir; guncel tepki listesini don
  setReaction(messageId, userId, emoji) {
    if (emoji) stmts.upsertReaction.run({ message_id: messageId, user_id: userId, emoji });
    else stmts.deleteReaction.run({ message_id: messageId, user_id: userId });
    return stmts.reactionsForMessage.all(messageId).map((r) => ({ userId: r.user_id, emoji: r.emoji }));
  },
  // Mevcut kullanici icin sohbet listesi: partner + son mesaj + okunmamis sayisi
  conversations(me) {
    const last = stmts.lastPerPartner.all({ me });
    const unreadRows = stmts.unreadCounts.all({ me });
    const unreadMap = new Map(unreadRows.map((r) => [r.partner_id, r.unread]));
    return last.map((row) => ({
      partner: publicUser(stmts.byId.get(row.partner_id)),
      lastMessage: {
        body: row.body,
        type: row.type || 'text',
        createdAt: row.created_at,
        mine: row.sender_id === me,
      },
      unread: unreadMap.get(row.partner_id) || 0,
    }));
  },
  // peer'dan gelen okunmamislari okundu yap; etkilenen olduysa true
  markRead(me, peer) {
    const info = stmts.markReadFrom.run({ me, peer, now: Date.now() });
    return info.changes > 0;
  },
};

// --- FAZ 5: gruplar ---
export function publicGroup(row, members) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    members: members ? members.map(publicUser) : undefined,
  };
}

export function publicGroupMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    body: row.body,
    type: row.type || 'text',
    mediaUrl: row.media_url || null,
    durationMs: row.duration_ms || null,
    createdAt: row.created_at,
  };
}

export const groupsRepo = {
  // Grup olustur: olusturan + secilen uyeler
  create({ id, name, avatarUrl = null, createdBy, memberIds = [] }) {
    const now = Date.now();
    const tx = db.transaction(() => {
      stmts.insertGroup.run({ id, name, avatar_url: avatarUrl, created_by: createdBy, created_at: now });
      const all = new Set([createdBy, ...memberIds]);
      for (const uid of all) stmts.addMember.run({ group_id: id, user_id: uid, joined_at: now });
    });
    tx();
    return stmts.groupById.get(id);
  },
  byId(id) {
    return stmts.groupById.get(id);
  },
  members(groupId) {
    return stmts.membersOf.all(groupId);
  },
  isMember(groupId, userId) {
    return !!stmts.isMember.get(groupId, userId);
  },
  groupIdsForUser(userId) {
    return stmts.groupIdsForUser.all(userId).map((r) => r.group_id);
  },
  addMessage({ id, groupId, senderId, body = '', type = 'text', mediaUrl = null, durationMs = null }) {
    stmts.insertGroupMessage.run({
      id, group_id: groupId, sender_id: senderId, body, type,
      media_url: mediaUrl, duration_ms: durationMs, created_at: Date.now(),
    });
    return stmts.groupMessageById.get(id);
  },
  thread(groupId) {
    return stmts.groupThread.all(groupId).map(publicGroupMessage);
  },
  // Kullanicinin gruplari: son mesaj + okunmamis sayisi
  listForUser(me) {
    const ids = stmts.groupIdsForUser.all(me).map((r) => r.group_id);
    return ids.map((gid) => {
      const g = stmts.groupById.get(gid);
      const member = stmts.memberRow.get(gid, me);
      const last = stmts.lastGroupMessage.get(gid);
      const unread = stmts.groupUnread.get({ gid, me, lastRead: member?.last_read_at || 0 }).n;
      return {
        group: publicGroup(g, stmts.membersOf.all(gid)),
        lastMessage: last
          ? { body: last.body, type: last.type || 'text', createdAt: last.created_at, mine: last.sender_id === me, senderId: last.sender_id }
          : null,
        unread,
      };
    });
  },
  markRead(groupId, me) {
    stmts.setGroupRead.run({ gid: groupId, me, now: Date.now() });
  },
};

export default db;
