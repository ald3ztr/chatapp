// Grup olusturma ekrani (FAZ 5)
// Grup adi + foto + uye secimi (coklu).

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useChat } from '../context/ChatContext.jsx';
import Avatar from '../components/Avatar.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import { ChevronLeft, Check } from '../components/Icons.jsx';

export default function CreateGroupScreen({ onBack, onCreated }) {
  const { addGroup } = useChat();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [name, setName] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.users().then(({ users }) => setUsers(users)).catch(() => {});
  }, []);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    setError('');
    if (name.trim().length < 2) return setError('Grup adi en az 2 karakter olmali.');
    if (selected.size < 1) return setError('En az bir uye sec.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('memberIds', [...selected].join(','));
      if (avatarFile) fd.append('avatar', avatarFile);
      const { group } = await api.createGroup(fd);
      addGroup(group);
      onCreated(group);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-neutral-950">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white/90 px-2 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800" aria-label="Geri">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex-1 text-base font-semibold">Yeni grup</h1>
        <button
          onClick={handleCreate}
          disabled={busy || name.trim().length < 2 || selected.size < 1}
          className="rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? '...' : 'Olustur'}
        </button>
      </header>

      <div className="mx-auto w-full max-w-md">
        {/* Grup foto + ad */}
        <div className="flex items-center gap-4 px-4 py-4">
          <AvatarPicker user={{ username: name || 'G' }} onChange={setAvatarFile} size={64} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Grup adi"
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 outline-none focus:border-violet-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
        </div>

        {error && <p className="px-4 pb-2 text-sm text-red-500">{error}</p>}

        <p className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
          Uyeler ({selected.size})
        </p>
        <ul className="divide-y divide-gray-100 dark:divide-neutral-800">
          {users.map((u) => {
            const on = selected.has(u.id);
            return (
              <li key={u.id}>
                <button
                  onClick={() => toggle(u.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900"
                >
                  <Avatar user={u} size={44} />
                  <span className="flex-1 truncate font-medium">{u.username}</span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                      on
                        ? 'border-violet-500 bg-violet-500 text-white'
                        : 'border-gray-300 dark:border-neutral-600'
                    }`}
                  >
                    {on && <Check size={14} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
