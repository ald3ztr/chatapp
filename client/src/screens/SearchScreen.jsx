// Mesaj arama ekrani (FAZ 4)

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import { ChevronLeft, Search } from '../components/Icons.jsx';
import { formatListTime } from '../lib/time.js';

export default function SearchScreen({ onBack, onOpenChat }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Yazarken (debounce) ara
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .search(term)
        .then(({ results }) => setResults(results))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Eslesmeyi vurgula
  function highlight(text) {
    const term = q.trim();
    const idx = text.toLocaleLowerCase('tr').indexOf(term.toLocaleLowerCase('tr'));
    if (idx < 0 || !term) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-fuchsia-200 text-inherit dark:bg-fuchsia-900/60">
          {text.slice(idx, idx + term.length)}
        </mark>
        {text.slice(idx + term.length)}
      </>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-neutral-950">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800"
          aria-label="Geri"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Mesajlarda ara..."
            className="w-full rounded-full bg-gray-100 py-2.5 pl-10 pr-4 text-sm outline-none dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1">
        {q.trim().length < 2 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-neutral-500">
            Aramak icin en az 2 karakter yaz.
          </p>
        ) : loading ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Araniyor...</p>
        ) : results.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400 dark:text-neutral-500">
            Sonuc bulunamadi.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
            {results.map((r) => (
              <li key={r.message.id}>
                <button
                  onClick={() => onOpenChat(r.partner)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900"
                >
                  <Avatar user={r.partner} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-semibold">{r.partner.username}</p>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatListTime(r.message.createdAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-gray-500 dark:text-neutral-400">
                      {r.mine && <span className="text-gray-400">Sen: </span>}
                      {highlight(r.message.body)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
