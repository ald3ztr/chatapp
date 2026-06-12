// Kayit ekrani (FAZ 1)
// Dogrulama yok: kullanici adi (+ opsiyonel foto) ile aninda kayit.

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('username', username.trim());
      if (avatarFile) fd.append('avatar', avatarFile);
      await register(fd);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 dark:bg-neutral-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Marka */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 bg-clip-text text-3xl font-bold text-transparent">
            ArzuDigital
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Arkadaslarinla sohbet et
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col items-center gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 dark:bg-neutral-900 dark:ring-neutral-800"
        >
          <AvatarPicker user={{ username }} onChange={setAvatarFile} />

          <div className="w-full">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-neutral-400">
              Kullanici adi
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ornek: arzu.91"
              autoFocus
              maxLength={20}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none transition focus:border-blue-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-800"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">
              2-20 karakter; harf, rakam, nokta ve alt cizgi.
            </p>
          </div>

          {error && (
            <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || username.trim().length < 2}
            className="w-full rounded-xl bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Olusturuluyor...' : 'Hemen basla'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-neutral-600">
          Sifre yok. Sadece bir kullanici adi sec, cihazinda hatirlanir.
        </p>
      </div>
    </div>
  );
}
