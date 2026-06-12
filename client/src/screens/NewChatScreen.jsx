// Yeni sohbet - kullanici secici (FAZ 2)

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import { ChevronLeft, Search, Users } from '../components/Icons.jsx';

export default function NewChatScreen({ onBack, onPick, onNewGroup }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .users()
      .then(({ users }) => active && setUsers(users))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/80 px-2 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800"
          aria-label="Geri"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-base font-semibold">Yeni sohbet</h1>
      </header>

      <div className="mx-auto w-full max-w-md px-4 py-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Search size={18} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Kullanici ara..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-md flex-1">
        {/* Yeni grup olustur */}
        <button
          onClick={onNewGroup}
          className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <Users size={22} />
          </span>
          <span className="font-semibold">Yeni grup</span>
        </button>

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">Yukleniyor...</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-neutral-500">
            {users.length === 0 ? 'Henuz baska kullanici yok.' : 'Eslesme bulunamadi.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => onPick(u)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-100 dark:hover:bg-neutral-900"
                >
                  <Avatar user={u} size={48} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{u.username}</p>
                    {u.status && (
                      <p className="truncate text-sm text-gray-500 dark:text-neutral-400">
                        {u.status}
                      </p>
                    )}
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
