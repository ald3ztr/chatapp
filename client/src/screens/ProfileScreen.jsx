// Profil duzenleme ekrani (FAZ 1)
// Kullanici adi, profil fotografi ve durum mesaji guncellenir.

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import { ChevronLeft } from '../components/Icons.jsx';

export default function ProfileScreen({ onBack }) {
  const { user, updateProfile, logout } = useAuth();
  const [username, setUsername] = useState(user.username);
  const [status, setStatus] = useState(user.status || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    username.trim() !== user.username ||
    (status || '') !== (user.status || '') ||
    avatarFile !== null;

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('username', username.trim());
      fd.append('status', status);
      if (avatarFile) fd.append('avatar', avatarFile);
      await updateProfile(fd);
      setAvatarFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-neutral-950">
      {/* Ust bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white/80 px-2 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800"
          aria-label="Geri"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-base font-semibold">Profili duzenle</h1>
      </header>

      <form onSubmit={handleSave} className="mx-auto w-full max-w-sm flex-1 px-6 py-6">
        <div className="mb-6 flex justify-center">
          <AvatarPicker user={user} onChange={setAvatarFile} />
        </div>

        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-neutral-400">
          Kullanici adi
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />

        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-neutral-400">
          Durum mesaji
        </label>
        <textarea
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          maxLength={140}
          rows={3}
          placeholder="Bugun nasil hissediyorsun?"
          className="mb-1 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-blue-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <p className="mb-4 text-right text-xs text-gray-400 dark:text-neutral-500">
          {status.length}/140
        </p>

        {error && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-300">
            Kaydedildi ✓
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !dirty || username.trim().length < 2}
          className="w-full rounded-xl bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Kaydediliyor...' : 'Kaydet'}
        </button>

        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full rounded-xl border border-red-200 py-3 font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Cikis yap
        </button>
      </form>
    </div>
  );
}
