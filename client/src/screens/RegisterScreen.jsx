// Giris / Kayit ekrani (FAZ 6)
// Kullanici adi + 4 haneli PIN. Ilk kez: kayit ol (PIN belirle).
// Sonra: ayni kullanici adi + PIN ile istedigin kadar giris yap.

import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import AvatarPicker from '../components/AvatarPicker.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';

export default function RegisterScreen() {
  const { register, login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  const canSubmit = username.trim().length >= 2 && pin.length === 4 && !busy;

  function onPinChange(v) {
    // Sadece rakam, en fazla 4 hane
    setPin(v.replace(/\D/g, '').slice(0, 4));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) {
        const fd = new FormData();
        fd.append('username', username.trim());
        fd.append('pin', pin);
        if (avatarFile) fd.append('avatar', avatarFile);
        await register(fd);
      } else {
        await login(username.trim(), pin);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setPin('');
  }

  const tabBtn = (active) =>
    `flex-1 rounded-lg py-2 text-sm font-semibold transition ${
      active
        ? 'bg-white text-violet-600 shadow-sm dark:bg-neutral-700 dark:text-white'
        : 'text-gray-500 dark:text-neutral-400'
    }`;

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
          {/* Giris / Kayit secici */}
          <div className="flex w-full gap-1 rounded-xl bg-gray-100 p-1 dark:bg-neutral-800">
            <button type="button" onClick={() => switchMode('login')} className={tabBtn(!isRegister)}>
              Giris yap
            </button>
            <button type="button" onClick={() => switchMode('register')} className={tabBtn(isRegister)}>
              Kayit ol
            </button>
          </div>

          {isRegister && <AvatarPicker user={{ username }} onChange={setAvatarFile} />}

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
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={20}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base outline-none transition focus:border-blue-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-800"
            />
          </div>

          <div className="w-full">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-neutral-400">
              4 haneli PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={pin}
              onChange={(e) => onPinChange(e.target.value)}
              placeholder="••••"
              maxLength={4}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-2xl tracking-[0.6em] outline-none transition focus:border-blue-400 focus:bg-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:bg-neutral-800"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-neutral-500">
              {isRegister
                ? 'Bu PIN ile sonra tekrar giris yapacaksin. Unutma!'
                : 'Kayit olurken belirledigin 4 haneli PIN.'}
            </p>
          </div>

          {error && (
            <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-blue-500 py-3 font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Lutfen bekle...' : isRegister ? 'Hesap olustur' : 'Giris yap'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-neutral-600">
          {isRegister
            ? 'Kullanici adi ve 4 haneli PIN sec; her cihazdan bu bilgilerle gir.'
            : 'Hesabin yok mu? Yukaridan "Kayit ol" sekmesine gec.'}
        </p>
      </div>
    </div>
  );
}
