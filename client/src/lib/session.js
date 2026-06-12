// Oturum kalicili (FAZ 1)
// Token'i localStorage'da tutar; uygulama yeniden acildiginda otomatik oturum icin.

const TOKEN_KEY = 'arzudigital:token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}
