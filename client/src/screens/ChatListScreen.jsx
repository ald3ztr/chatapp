// Sohbet listesi ekrani (FAZ 2 + FAZ 5) - DM + grup birlesik
// Her sohbet: avatar, ad, son mesaj onizlemesi, zaman, okunmamis rozeti.

import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { usePresence } from '../context/PresenceContext.jsx';
import Avatar from '../components/Avatar.jsx';
import GroupAvatar from '../components/GroupAvatar.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { Edit, ChatBubble, ImageIcon, Mic, Search } from '../components/Icons.jsx';
import { formatListTime } from '../lib/time.js';

// Son mesaj onizlemesi (medya tipine gore ikon + metin)
function Preview({ m }) {
  if (!m) return <span className="italic text-gray-400">Henuz mesaj yok</span>;
  if (m.type === 'image')
    return (
      <span className="inline-flex items-center gap-1">
        <ImageIcon size={14} /> Fotograf
      </span>
    );
  if (m.type === 'audio')
    return (
      <span className="inline-flex items-center gap-1">
        <Mic size={14} /> Sesli mesaj
      </span>
    );
  return <>{m.body}</>;
}

// DM avatari + cevrimici nokta
function ConvAvatar({ user }) {
  const presence = usePresence();
  const online = presence?.[user.id]?.online;
  return (
    <div className="relative shrink-0">
      <Avatar user={user} size={56} />
      {online && (
        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-neutral-950" />
      )}
    </div>
  );
}

export default function ChatListScreen({ onOpenChat, onNewChat, onEditProfile, onSearch }) {
  const { user } = useAuth();
  const { chats } = useChat();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white dark:bg-neutral-950">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <h1 className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-xl font-bold text-transparent">
          ArzuDigital
        </h1>
        <div className="flex items-center gap-1">
          <button
            onClick={onSearch}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            aria-label="Ara"
          >
            <Search size={21} />
          </button>
          <ThemeToggle />
          <button
            onClick={onNewChat}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
            aria-label="Yeni sohbet"
          >
            <Edit size={22} />
          </button>
          <button onClick={onEditProfile} aria-label="Profili duzenle" className="ml-1">
            <Avatar user={user} size={32} className="ring-2 ring-gray-100 dark:ring-neutral-800" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1">
        {chats.length === 0 ? (
          <div className="mt-20 flex flex-col items-center gap-3 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-neutral-900 dark:text-neutral-500">
              <ChatBubble size={30} />
            </span>
            <p className="font-semibold text-gray-700 dark:text-neutral-200">Henuz sohbet yok</p>
            <p className="text-sm text-gray-400 dark:text-neutral-500">
              Yeni bir sohbet ya da grup baslatmak icin sag ustteki kalem simgesine dokun.
            </p>
          </div>
        ) : (
          <ul>
            {chats.map((c) => {
              const isGroup = c.kind === 'group';
              const name = isGroup ? c.group.name : c.partner.username;
              return (
                <li key={`${c.kind}-${c.id}`}>
                  <button
                    onClick={() => onOpenChat(c)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-neutral-900"
                  >
                    {isGroup ? <GroupAvatar group={c.group} size={56} /> : <ConvAvatar user={c.partner} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold">{name}</p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-xs text-gray-400 dark:text-neutral-500">
                            {formatListTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-sm ${
                            c.unread > 0
                              ? 'font-medium text-gray-900 dark:text-neutral-100'
                              : 'text-gray-500 dark:text-neutral-400'
                          }`}
                        >
                          {c.lastMessage?.mine && <span className="text-gray-400">Sen: </span>}
                          <Preview m={c.lastMessage} />
                        </p>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 px-1.5 text-xs font-semibold text-white">
                            {c.unread > 4 ? '4+' : c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
