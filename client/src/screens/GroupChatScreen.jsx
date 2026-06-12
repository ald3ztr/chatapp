// Grup sohbet ekrani (FAZ 5)
// Coklu uye; gonderen avatari + adi gosterilir. Metin/emoji/foto/ses.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useChat } from '../context/ChatContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useRecorder } from '../lib/useRecorder.js';
import Avatar from '../components/Avatar.jsx';
import GroupAvatar from '../components/GroupAvatar.jsx';
import EmojiPicker from '../components/EmojiPicker.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import ImageLightbox from '../components/ImageLightbox.jsx';
import {
  ChevronLeft, Camera, Mic, ImageIcon, Smile, Plus, Send, Trash, Music, Clock, AlertCircle, ChatBubble,
} from '../components/Icons.jsx';
import { formatTime, formatDaySeparator, sameDay } from '../lib/time.js';

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Gondericiye gore tutarli renk (grup isimleri renkli olsun)
const NAME_COLORS = ['text-rose-500', 'text-sky-500', 'text-emerald-500', 'text-amber-500', 'text-violet-500', 'text-fuchsia-500', 'text-teal-500'];
function colorFor(id) {
  let sum = 0;
  for (const ch of id || '') sum += ch.charCodeAt(0);
  return NAME_COLORS[sum % NAME_COLORS.length];
}

export default function GroupChatScreen({ group: initialGroup, onBack }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const { setActiveGroup, markGroupRead, bumpGroup } = useChat();
  const recorder = useRecorder();

  const [group, setGroup] = useState(initialGroup);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [typers, setTypers] = useState({}); // userId -> username (su an yazanlar)

  const bottomRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const typingTimer = useRef(null);

  // Uye haritasi: senderId -> user
  const memberMap = useMemo(() => {
    const m = {};
    (group.members || []).forEach((u) => (m[u.id] = u));
    return m;
  }, [group]);

  useEffect(() => {
    let active = true;
    setActiveGroup(group.id);
    setLoading(true);
    api
      .groupMessages(group.id)
      .then(({ group: g, messages }) => {
        if (!active) return;
        setGroup(g);
        setMessages(messages);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    markGroupRead(group.id);
    return () => {
      active = false;
      setActiveGroup(null);
    };
  }, [group.id, setActiveGroup, markGroupRead]);

  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const onNew = ({ message }) => {
      if (message.groupId !== group.id) return;
      setMessages((prev) => [...prev, message]);
      markGroupRead(group.id);
    };
    const onTyping = ({ groupId, from, typing }) => {
      if (groupId !== group.id) return;
      setTypers((prev) => {
        const next = { ...prev };
        if (typing) next[from.id] = from.username;
        else delete next[from.id];
        return next;
      });
    };
    s.on('group:message:new', onNew);
    s.on('group:typing', onTyping);
    return () => {
      s.off('group:message:new', onNew);
      s.off('group:typing', onTyping);
    };
  }, [socket, connected, group.id, markGroupRead]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading, showEmoji, typers]);

  function emitTyping(typing) {
    socket.current?.emit('group:typing', { groupId: group.id, typing });
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
      id: tempId, groupId: group.id, senderId: user.id, body, type,
      mediaUrl: localUrl, durationMs, createdAt: Date.now(), pending: true,
    };
    setMessages((prev) => [...prev, temp]);
    try {
      let mediaUrl = null;
      if (file) {
        setUploading(true);
        mediaUrl = (await api.upload(file)).url;
        setUploading(false);
      }
      const saved = await new Promise((resolve, reject) => {
        const s = socket.current;
        if (!s) return reject(new Error('Baglanti yok'));
        s.emit('group:message:send', { groupId: group.id, type, body, mediaUrl, durationMs }, (res) =>
          res?.error ? reject(new Error(res.error)) : resolve(res.message)
        );
      });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m)));
      bumpGroup(group.id, saved);
      if (localUrl) URL.revokeObjectURL(localUrl);
    } catch {
      setUploading(false);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, failed: true, pending: false } : m)));
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

  const typerNames = Object.values(typers);
  const subtitle =
    typerNames.length === 1 ? `${typerNames[0]} yaziyor...`
    : typerNames.length > 1 ? `${typerNames.length} kisi yaziyor...`
    : (group.members || []).map((m) => m.username).join(', ');

  const iconBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 dark:text-neutral-300 dark:hover:bg-neutral-800';

  return (
    <div className="flex h-[100dvh] flex-col bg-white dark:bg-neutral-950">
      <header className="flex items-center gap-2 border-b border-gray-100 px-2 py-2 dark:border-neutral-800">
        <button onClick={onBack} className={iconBtn} aria-label="Geri">
          <ChevronLeft size={26} />
        </button>
        <GroupAvatar group={group} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{group.name}</p>
          <p className={`truncate text-xs ${typerNames.length ? 'text-fuchsia-500' : 'text-gray-400 dark:text-neutral-500'}`}>
            {subtitle}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="mx-auto flex max-w-md flex-col gap-1.5">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Yukleniyor...</p>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-gray-400 dark:text-neutral-500">
              <ChatBubble size={28} />
              <p className="text-sm">Gruba ilk mesaji sen gonder.</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderId === user.id;
              const prev = messages[i - 1];
              const next = messages[i + 1];
              const showDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const isImage = m.type === 'image';
              const sender = memberMap[m.senderId];
              // Grup: gonderen adini grup basinda goster, avatari grup sonunda
              const firstOfRun = !prev || prev.senderId !== m.senderId || showDay;
              const lastOfRun = !next || next.senderId !== m.senderId;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-4 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      {formatDaySeparator(m.createdAt)}
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {!mine && (
                      <div className="w-7 shrink-0">{lastOfRun && <Avatar user={sender || { username: '?' }} size={28} />}</div>
                    )}
                    <div className={`flex min-w-0 flex-col ${mine ? 'items-end' : 'items-start'}`}>
                      {!mine && firstOfRun && sender && (
                        <span className={`mb-0.5 ml-1 text-xs font-semibold ${colorFor(sender.id)}`}>
                          {sender.username}
                        </span>
                      )}
                      <div
                        className={`w-fit max-w-[78%] overflow-hidden text-[15px] ${
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
                            onClick={() => m.mediaUrl && setLightbox(m.mediaUrl)}
                            className="max-h-72 w-full cursor-pointer object-cover"
                          />
                        ) : m.type === 'audio' ? (
                          <div className="flex items-end gap-2">
                            <AudioPlayer src={m.mediaUrl} durationMs={m.durationMs} mine={mine} />
                            <span className={`flex items-center gap-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-400'}`}>
                              {m.pending ? <Clock size={11} /> : m.failed ? <AlertCircle size={11} className="text-red-400" /> : formatTime(m.createdAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="inline">
                            <span className="whitespace-pre-wrap break-words">{m.body}</span>
                            <span className={`ml-2 inline-flex translate-y-0.5 items-center text-[10px] ${mine ? 'text-white/70' : 'text-gray-400 dark:text-neutral-500'}`}>
                              {m.pending ? <Clock size={11} /> : m.failed ? <AlertCircle size={11} className="text-red-400" /> : formatTime(m.createdAt)}
                            </span>
                          </span>
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
        <div className="bg-violet-50 py-1 text-center text-xs text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">Yukleniyor...</div>
      )}

      {showEmoji && <EmojiPicker onSelect={(e) => setText((t) => t + e)} onClose={() => setShowEmoji(false)} />}

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
            <button onClick={recorder.cancel} className={iconBtn} aria-label="Iptal"><Trash size={20} /></button>
            <button onClick={handleStopAndSend} className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white" aria-label="Sesi gonder">
              <Send size={18} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="relative flex items-center gap-1.5">
            <button type="button" onClick={() => imageInputRef.current?.click()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white" aria-label="Fotograf">
              <Camera size={18} />
            </button>
            <input
              value={text}
              onChange={(e) => onChangeText(e.target.value)}
              onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
              placeholder="Mesaj..."
              className="min-w-0 flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[15px] outline-none dark:bg-neutral-800 dark:text-neutral-100"
            />
            {text.trim() ? (
              <button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white" aria-label="Gonder">
                <Send size={18} />
              </button>
            ) : (
              <>
                <button type="button" onClick={recorder.start} className={iconBtn} aria-label="Sesli mesaj kaydet"><Mic size={21} /></button>
                <button type="button" onClick={() => imageInputRef.current?.click()} className={iconBtn} aria-label="Fotograf"><ImageIcon size={21} /></button>
                <button type="button" onClick={() => { setShowEmoji((v) => !v); setShowAttach(false); }} className={iconBtn} aria-label="Emoji"><Smile size={21} /></button>
                <button type="button" onClick={() => { setShowAttach((v) => !v); setShowEmoji(false); }} className={iconBtn} aria-label="Daha fazla"><Plus size={21} /></button>
              </>
            )}
            {showAttach && (
              <div className="absolute bottom-12 right-0 z-10 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
                <button type="button" onClick={() => audioInputRef.current?.click()} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-neutral-700">
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
