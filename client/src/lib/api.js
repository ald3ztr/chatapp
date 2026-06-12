// API yardimcilari (FAZ 1)
// Token'i Authorization basligi ile gonderir.

import { getToken } from './session.js';

async function parse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Istek basarisiz (${res.status})`);
  }
  return data;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = {
  // Kayit: FormData (username + opsiyonel avatar dosyasi)
  async register(formData) {
    const res = await fetch('/api/register', { method: 'POST', body: formData });
    return parse(res); // { token, user }
  },

  // Otomatik oturum: token gecerliyse kullaniciyi getir
  async me() {
    const res = await fetch('/api/me', { headers: { ...authHeaders() } });
    return parse(res); // { user }
  },

  // Profil guncelle: FormData (username?, status?, avatar?)
  async updateProfile(formData) {
    const res = await fetch('/api/me', {
      method: 'PUT',
      headers: { ...authHeaders() },
      body: formData,
    });
    return parse(res); // { user }
  },

  // Sohbet baslatmak icin tum kullanicilar
  async users() {
    const res = await fetch('/api/users', { headers: { ...authHeaders() } });
    return parse(res); // { users }
  },

  // Sohbet listesi (son mesaj + okunmamis)
  async conversations() {
    const res = await fetch('/api/conversations', { headers: { ...authHeaders() } });
    return parse(res); // { conversations }
  },

  // Bir kullaniciyla mesaj gecmisi (acilinca okundu isaretlenir)
  async messages(peerId) {
    const res = await fetch(`/api/messages/${peerId}`, { headers: { ...authHeaders() } });
    return parse(res); // { peer, messages }
  },

  // Sohbeti okundu isaretle
  async markRead(peerId) {
    const res = await fetch(`/api/messages/${peerId}/read`, {
      method: 'POST',
      headers: { ...authHeaders() },
    });
    return parse(res); // { ok }
  },

  // Mesaj arama → { results: [{ message, partner, mine }] }
  async search(q) {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      headers: { ...authHeaders() },
    });
    return parse(res);
  },

  // --- Gruplar (FAZ 5) ---
  async createGroup(formData) {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData,
    });
    return parse(res); // { group }
  },
  async groups() {
    const res = await fetch('/api/groups', { headers: { ...authHeaders() } });
    return parse(res); // { groups }
  },
  async groupMessages(groupId) {
    const res = await fetch(`/api/groups/${groupId}/messages`, { headers: { ...authHeaders() } });
    return parse(res); // { group, messages }
  },

  // Medya yukle (gorsel/ses) → { url, mime, size }
  async upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { ...authHeaders() },
      body: fd,
    });
    return parse(res);
  },
};
