// Zaman/tarih yardimcilari (FAZ 2)

const tr = {
  days: ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'],
};

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Mesaj saati: 14:05
export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Sohbet listesi zamani: bugunse saat, dunse "Dun", bu haftaysa gun adi, yoksa tarih
export function formatListTime(ts) {
  const now = Date.now();
  const today = startOfDay(now);
  const day = startOfDay(ts);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays <= 0) return formatTime(ts);
  if (diffDays === 1) return 'Dun';
  if (diffDays < 7) return tr.days[new Date(ts).getDay()];
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Gun ayiraci etiketi: Bugun / Dun / 12 Haziran 2026
export function formatDaySeparator(ts) {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return 'Bugun';
  if (diffDays === 1) return 'Dun';
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Iki zaman damgasi ayni gunde mi?
export function sameDay(a, b) {
  return startOfDay(a) === startOfDay(b);
}

// Son gorulme: "az once", "5 dk once", "bugun 14:05", "dun", tarih
export function formatLastSeen(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'az once';
  if (min < 60) return `${min} dk once`;
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  const diffDays = Math.round((today - day) / 86400000);
  if (diffDays === 0) return `bugun ${formatTime(ts)}`;
  if (diffDays === 1) return `dun ${formatTime(ts)}`;
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}
