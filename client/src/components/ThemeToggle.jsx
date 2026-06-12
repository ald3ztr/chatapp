// Dark/light gecis butonu (FAZ 1 - altyapi FAZ 0'da hazirdi)
import { useState } from 'react';
import { toggleTheme } from '../theme.js';
import { Sun, Moon } from './Icons.jsx';

export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  return (
    <button
      onClick={() => setIsDark(toggleTheme() === 'dark')}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800 ${className}`}
      aria-label="Temayi degistir"
      title="Temayi degistir"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
