// Birebir sohbet ekrani (FAZ 2+3+4) - Instagram DM tarzi
// Metin/emoji/foto/ses + yaziyor, mesaj durumlari, presence, tepkiler.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { usePresence } from '../context/PresenceContext.jsx';
import { useCall } from '../context/CallContext.jsx';
import { useRecorder } from '../lib/useRecorder.js';
import Avatar from '../components/Avatar.jsx';
import EmojiPicker from '../components/EmojiPicker.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import ImageLightbox from '../components/ImageLightbox.jsx';
import ReactionBar from '../components/ReactionBar.jsx';
import {
  ChevronLeft, Phone, Video, Camera, Mic, ImageIcon, Smile, Plus, Send,
  Trash, Music, Clock, AlertCircle, ChatBubble, Check, CheckCheck,
} from '../components/Icons.jsx';
import { formatTime, formatDaySeparator, formatLastSeen, sameDay } from '../lib/time.js';

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Gonderdigim mesajin durumu: bekliyor / gonderildi / iletildi / okundu
function Status({ m }) {
  if (m.pending) return <Clock size={13} className="text-white/70" />;
  if (m.failed) return <AlertCircle size={13} className="text-red-300" />;
  if (m.readAt) return <CheckCheck size={15} className="text-sky-200" />;
  if (m.deliveredAt) return <CheckCheck size={15} className="text-white/70" />;
  return <Check size={15} className="text-white/70" />;
}

export default function ChatScreen({ peer, onBack }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { setActivePeer, markRead, bumpConversation } = useChat();
  const presence = usePresence(peer.id);
  const { startCall } = useCall();
  const recorder = useRecorder();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [reactingId, setReactingId] = useState(null);

  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const typingTimer = useRef(null);

  // Gecmisi yukle + aktif/okundu
  useEffect(() => {
    let active = true;
    setActivePeer(peer.id);
    setLoading(true);
    api
      .messages(peer.id)
      .then(({ messages }) => active && setMessages(messages))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    markRead(peer.id);
    return () => {
      active = false;
      setActivePeer(null);
    };
  }, [peer.id, setActivePeer, markRead]);

  // Tum canli olaylar: yeni mesaj, yaziyor, iletildi, okundu, tepki
  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    const onNew = ({ message, from }) => {
      if (from.id !== peer.id) return;
      setMessages((prev) => [...prev, message]);
      markRead(peer.id);
    };
    const onTyping = ({ from, typing }) => {
      if (from === peer.id) setPeerTyping(typing);
    };
    const onDelivered = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, deliveredAt: Date.now() } : m))
      );
    };
    const onRead = ({ by }) => {
      if (by !== peer.id) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === user.id && !m.readAt ? { ...m, readAt: Date.now() } : m))
      );
    };
    const onReaction = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    };

    s.on('message:new', onNew);
    s.on('typing', onTyping);
    s.on('message:delivered', onDelivered);
    s.on('message:read', onRead);
    s.on('reaction:update', onReaction);
    return () => {
      s.off('message:new', onNew);
      s.off('typing', onTyping);
      s.off('message:delivered', onDelivered);
      s.off('message:read', onRead);
      s.off('reaction:update', onReaction);
    };
  }, [socket, connected, peer.id, user.id, markRead]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading, showEmoji, peerTyping]);

  // Yaziyor gostergesini karsi tarafa bildir
  function emitTyping(typing) {
    socket.current?.emit('typing', { toUserId: peer.id, typing });
  }
  function onChangeText(v) {
    setText(v);
    emitTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 1500);
  }
  useEffect(() => () => { clearTimeout(typingTimer.current); emitTyping(false); }, []); // eslint-disable-line

  async function sendMessage({ type = 'text', body = '', file = null, durationMs = null }) {
    const tempId = `temp-${Date.now()}`;
    const localUrl = file ? URL.createObjectURL(file) : null;
    const temp = {
      id: tempId, senderId: user.id, receiverId: peer.id,
      body, type, mediaUrl: localUrl, durationMs, createdAt: Date.now(), pending: true, reactions: [],
    };
    setMessages((prev) => [...prev, temp]);

    try {
      let mediaUrl = null;
      if (file) {
        setUploading(true);
        const up = await api.upload(file);
        mediaUrl = up.url;
        setUploading(false);
      }
      const saved = await new Promise((resolve, reject) => {
        const s = socket.current;
        if (!s) return reject(new Error('Baglanti yok'));
        s.emit('message:send', { toUserId: peer.id, type, body, mediaUrl, durationMs }, (res) =>
          res?.error ? reject(new Error(res.error)) : resolve(res.message)
        );
      });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...saved, reactions: [] } : m)));
      bumpConversation(peer, saved);
      if (localUrl) URL.revokeObjectURL(localUrl);
    } catch {
      setUploading(false);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, failed: true, pending: false } : m))
      );
    }
  }

  function handleSendText(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText('');
    setShowEmoji(false);
    clearTimeout(typingTimer.current);
    emitTyping(false);
    sendMessage({ type: 'text', body });
  }

  function handleImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowAttach(false);
    if (file) sendMessage({ type: 'image', file });
  }
  function handleAudioPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setShowAttach(false);
    if (file) sendMessage({ type: 'audio', file });
  }
  async function handleStopAndSend() {
    const result = await recorder.stop();
    if (result?.blob) {
      const ext = result.blob.type.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([result.blob], `ses-${Date.now()}.${ext}`, { type: result.blob.type });
      sendMessage({ type: 'audio', file, durationMs: result.durationMs });
    }
  }

  // Tepki ver (iyimser + sunucuya bildir)
  function react(messageId, emoji) {
    setReactingId(null);
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const others = (m.reactions || []).filter((r) => r.userId !== user.id);
        return { ...m, reactions: emoji ? [...others, { userId: user.id, emoji }] : others };
      })
    );
    socket.current?.emit('reaction:set', { messageId, emoji }, (res) => {
      if (res?.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions } : m))
        );
      }
    });
  }

  const subtitle = peerTyping
    ? 'yaziyor...'
    : presence.online
    ? 'Cevrimici'
    : presence.lastSeen
    ? `son gorulme ${formatLastSeen(presence.lastSeen)}`
    : peer.status || 'ArzuDigital';

  const iconBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800';

  return (
    <div className="flex h-[100dvh] flex-col bg-white dark:bg-neutral-950">
      {/* Ust bar */}
      <header className="flex items-center gap-2 border-b border-gray-100 px-2 py-2 dark:border-neutral-800">
        <button onClick={onBack} className={iconBtn} aria-label="Geri">
          <ChevronLeft size={26} />
        </button>
        <div className="relative shrink-0">
          <Avatar user={peer} size={40} />
          {presence.online && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-neutral-950" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{peer.username}</p>
          <p
            className={`truncate text-xs ${
              peerTyping ? 'text-fuchsia-500' : 'text-gray-400 dark:text-neutral-500'
            }`}
          >
            {subtitle}
          </p>
        </div>
        <button onClick={() => startCall(peer, 'audio')} className={iconBtn} aria-label="Sesli arama">
          <Phone size={22} />
        </button>
        <button onClick={() => startCall(peer, 'video')} className={iconBtn} aria-label="Goruntulu arama">
          <Video size={22} />
        </button>
      </header>

      {/* Mesajlar */}
      <div className="flex-1 overflow-y-auto px-3 py-3" onClick={() => setReactingId(null)}>
        <div className="mx-auto flex max-w-md flex-col gap-1.5">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Yukleniyor...</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-400 dark:text-neutral-500">
              <ChatBubble size={28} />
              <p className="text-sm">Henuz mesaj yok. Ilk mesaji sen gonder.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderId === user.id;
              const prev = messages[i - 1];
              const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const isImage = m.type === 'image';
              // Gelen mesaj grubunun son baloncugu mu? (avatar sadece orada gosterilir)
              const next = messages[i + 1];
              const isLastOfGroup = !mine && (!next || next.senderId !== m.senderId);
              const myReaction = (m.reactions || []).find((r) => r.userId === user.id)?.emoji || null;
              // Tepkileri emoji -> sayi olarak grupla
              const grouped = Object.entries(
                (m.reactions || []).reduce((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              );
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-4 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      {formatDaySeparator(m.createdAt)}
                    </div>
                  )}
                  <div
                    className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${
                      grouped.length ? 'mb-4' : ''
                    }`}
                  >
                    {/* Karsi tarafin avatari - grubun son mesajinda (yoksa hizalama icin bosluk) */}
                    {!mine && (
                      <div className="w-7 shrink-0">
                        {isLastOfGroup && <Avatar user={peer} size={28} />}
                      </div>
                    )}
                    <div className={`flex min-w-0 flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {reactingId === m.id && (
                        <ReactionBar mine={mine} current={myReaction} onPick={(e) => react(m.id, e)} />
                      )}
                      {/* Baloncuk + tepki rozetleri (rozetler baloncugun DISINDA, kirpilmaz) */}
                      <div className="relative w-fit max-w-[78%]">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!m.pending && !String(m.id).startsWith('temp-'))
                            setReactingId((id) => (id === m.id ? null : m.id));
                        }}
                        className={`cursor-pointer overflow-hidden text-[15px] ${
                          isImage
                            ? 'rounded-3xl'
                            : `px-3.5 py-2 ${
                                mine
                                  ? 'rounded-3xl rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white'
                                  : 'rounded-3xl rounded-bl-md bg-gray-100 text-gray-900 dark:bg-neutral-800 dark:text-neutral-100'
                              }`
                        } ${m.failed ? 'opacity-60 ring-2 ring-red-400' : ''}`}
                      >
                        {isImage ? (
                          <img
                            src={m.mediaUrl}
                            alt="gorsel"
                            onClick={(e) => {
                              e.stopPropagation();
                              m.mediaUrl && setLightbox(m.mediaUrl);
                            }}
                            className="max-h-72 w-full object-cover"
                          />
                        ) : m.type === 'audio' ? (
                          <div className="flex items-end gap-2">
                            <AudioPlayer src={m.mediaUrl} durationMs={m.durationMs} mine={mine} />
                            <span className={`flex items-center gap-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                              {formatTime(m.createdAt)} {mine && <Status m={m} />}
                            </span>
                          </div>
                        ) : (
                          <span className="inline">
                            <span className="whitespace-pre-wrap break-words">{m.body}</span>
                            <span className="ml-2 inline-flex translate-y-0.5 items-center gap-1">
                              <span className={`text-[10px] ${mine ? 'text-white/70' : 'text-gray-400 dark:text-neutral-500'}`}>
                                {formatTime(m.createdAt)}
                              </span>
                              {mine && <Status m={m} />}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* Tepki rozetleri - baloncugun alt kosesinde, kirpilmadan */}
                      {grouped.length > 0 && (
                        <div className={`absolute -bottom-2.5 ${mine ? 'right-2' : 'left-2'} flex gap-0.5`}>
                          {grouped.map(([emoji, count]) => (
                            <span
                              key={emoji}
                              className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-xs shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
                            >
                              {emoji}
                              {count > 1 && <span className="text-[10px] text-gray-500">{count}</span>}
                            </span>
                          ))}
                        </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {uploading && (
        <div className="bg-violet-50 py-1 text-center text-xs text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
          Yukleniyor...
        </div>
      )}

      {showEmoji && (
        <EmojiPicker onSelect={(e) => setText((t) => t + e)} onClose={() => setShowEmoji(false)} />
      )}

      {/* Input bar */}
      <div
        className="border-t border-gray-100 px-2 py-2 dark:border-neutral-800"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        {recorder.recording ? (
          <div className="flex items-center gap-3 px-1">
            <span className="flex items-center gap-2 text-red-500">
              <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-medium tabular-nums">{fmtElapsed(recorder.elapsedMs)}</span>
            </span>
            <span className="flex-1 text-sm text-gray-400">Kayit aliniyor...</span>
            <button onClick={recorder.cancel} className={iconBtn} aria-label="Iptal">
              <Trash size={20} />
            </button>
            <button
              onClick={handleStopAndSend}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
              aria-label="Sesi gonder"
            >
              <Send size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
              aria-label="Fotograf"
            >
              <Camera size={18} />
            </button>

            <input
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              onFocus={() => {
                setShowEmoji(false);
                setShowAttach(false);
              }}
              placeholder="Mesaj..."
              className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[15px] outline-none dark:bg-neutral-800 dark:text-neutral-100"
            />

            {text.trim() ? (
              <button
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                aria-label="Gonder"
              >
                <Send size={18} />
              </button>
            ) : (
              <>
                <button type="button" onClick={recorder.start} className={iconBtn} aria-label="Sesli mesaj kaydet">
                  <Mic size={21} />
                </button>
                <button type="button" onClick={() => imageInputRef.current?.click()} className={iconBtn} aria-label="Fotograf">
                  <ImageIcon size={21} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEmoji((v) => !v); setShowAttach(false); }}
                  className={iconBtn}
                  aria-label="Emoji"
                >
                  <Smile size={21} />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAttach((v) => !v); setShowEmoji(false); }}
                  className={iconBtn}
                  aria-label="Daha fazla"
                >
                  <Plus size={21} />
                </button>
              </>
            )}

            {showAttach && (
              <div className="absolute bottom-12 right-0 z-10 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-neutral-700"
                >
                  <Music size={18} /> Ses dosyasi
                </button>
              </div>
            )}

            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioPick} />
          </form>
        )}
        {recorder.error && <p className="mt-1 px-2 text-xs text-red-500">{recorder.error}</p>}
      </div>

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
