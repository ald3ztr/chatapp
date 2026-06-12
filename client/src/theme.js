// dark/light mode altyapisi (FAZ 0)
// Temayi <html> uzerinde 'dark' sinifi ile yonetir, secimi localStorage'a yazar.
// FAZ 5'te bunun uzerine bir gecis butonu eklenecek.

const STORAGE_KEY = 'arzudigital:theme';

export function getStoredTheme() {
  return localStorage.getItem(STORAGE_KEY); // 'dark' | 'light' | null
}

export function resolveInitialTheme() {
  const stored = getStoredTheme();
  if (stored === 'dark' || stored === 'light') return stored;
  // Kayit yoksa cihaz tercihine bak
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme() {
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

// Uygulama ilk yuklenirken cagrilir
export function initTheme() {
  applyTheme(resolveInitialTheme());
}
