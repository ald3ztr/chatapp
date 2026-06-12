// Emoji secici (FAZ 3) - bagimliliksiz, kategorili
// Bir emojiye tiklayinca onSelect ile karakteri yukari verir.

import { useState } from 'react';
import { X } from './Icons.jsx';

const CATEGORIES = [
  {
    key: 'smileys',
    icon: '😀',
    emojis: ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  },
  {
    key: 'gestures',
    icon: '👍',
    emojis: ['👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤛','🤜','👏','🙌','👐','🤲','🙏','✍️','💅','🤝','💪','🦾','👀','👁️','👅','👄','🫶','🫰','🤳'],
  },
  {
    key: 'hearts',
    icon: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💋','💯','💢','💥','💫','💦','💨','🔥','⭐','🌟','✨','⚡','🎉','🎊','🎁'],
  },
  {
    key: 'animals',
    icon: '🐶',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🐤','🦄','🐝','🦋','🐌','🐞','🐢','🐍','🦖','🐙','🦑','🦀','🐳','🐬','🐟','🐠','🦈','🐊','🐅','🦓','🦒','🐘','🐫','🦔'],
  },
  {
    key: 'food',
    icon: '🍕',
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🌽','🌶️','🥕','🧄','🧅','🥔','🍞','🥐','🥨','🧀','🥚','🍳','🥞','🧇','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🥙','🍜','🍝','🍣','🍦','🍰','🎂','🍫','🍬','🍭','🍩','🍪','☕','🍵','🥤','🍺','🍻','🥂','🍷'],
  },
  {
    key: 'activity',
    icon: '⚽',
    emojis: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥅','⛳','🏹','🎣','🥊','🥋','⛸️','🎿','🛹','🛼','🎮','🕹️','🎲','🎯','🎳','🎸','🎹','🥁','🎺','🎻','🎤','🎧','🎬','🎨','♟️','🏆','🥇','🥈','🥉','🚗','✈️','🚀','🌍','🏖️','⛰️','🌈','☀️','🌙'],
  },
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [tab, setTab] = useState(0);
  const cat = CATEGORIES[tab];

  return (
    <div className="border-t border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      {/* Kategori sekmeleri */}
      <div className="flex items-center justify-between border-b border-gray-100 px-2 dark:border-neutral-800">
        <div className="flex">
          {CATEGORIES.map((c, i) => (
            <button
              key={c.key}
              onClick={() => setTab(i)}
              className={`px-2.5 py-2 text-lg transition ${
                i === tab ? 'opacity-100' : 'opacity-40 hover:opacity-70'
              }`}
              aria-label={c.key}
            >
              {c.icon}
            </button>
          ))}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center px-2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Emoji izgarasi */}
      <div className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto p-2">
        {cat.emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            onClick={() => onSelect(e)}
            className="flex h-9 items-center justify-center rounded-lg text-xl transition hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
