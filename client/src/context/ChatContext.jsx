// Sohbet durumu (FAZ 2 + FAZ 5 gruplar)
// DM + grup sohbetlerini birlesik tutar, gelen mesajlari global dinler.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { playNotification } from '../lib/sound.js';
import { useAuth } from './AuthContext.jsx';
import { useSocket } from './SocketContext.jsx';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [conversations, setConversations] = useState([]); // DM'ler
  const [groups, setGroups] = useState([]); // gruplar
  const activePeerRef = useRef(null);
  const activeGroupRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [{ conversations }, { groups }] = await Promise.all([api.conversations(), api.groups()]);
      setConversations(conversations);
      setGroups(groups);
    } catch {
      /* sessizce gec */
    }
  }, []);

  useEffect(() => {
    if (user) refresh();
    else {
      setConversations([]);
      setGroups([]);
    }
  }, [user, refresh]);

  // Global socket dinleyicileri
  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    // DM mesaji
    function onNew({ message, from }) {
      const mine = message.senderId === user?.id; // kendi mesajim (orn. kendi cevapsiz aramam)
      const isActive = activePeerRef.current === from.id;
      if (!mine && (!isActive || document.hidden)) playNotification();
      setConversations((prev) => {
        const others = prev.filter((c) => c.partner.id !== from.id);
        const existing = prev.find((c) => c.partner.id === from.id);
        return [
          {
            partner: from,
            lastMessage: { body: message.body, type: message.type || 'text', createdAt: message.createdAt, mine },
            unread: mine || isActive ? existing?.unread || 0 : (existing?.unread || 0) + 1,
          },
          ...others,
        ];
      });
    }

    // Grup mesaji
    function onGroupNew({ message, from }) {
      const isActive = activeGroupRef.current === message.groupId;
      if (!isActive || document.hidden) playNotification();
      setGroups((prev) =>
        prev.map((g) =>
          g.group.id === message.groupId
            ? {
                ...g,
                lastMessage: { body: message.body, type: message.type || 'text', createdAt: message.createdAt, mine: false, senderId: from.id },
                unread: isActive ? 0 : (g.unread || 0) + 1,
              }
            : g
        )
      );
    }

    // Yeni gruba eklendin
    function onGroupCreated() {
      refresh();
    }

    s.on('message:new', onNew);
    s.on('group:message:new', onGroupNew);
    s.on('group:new', onGroupCreated);
    return () => {
      s.off('message:new', onNew);
      s.off('group:message:new', onGroupNew);
      s.off('group:new', onGroupCreated);
    };
  }, [socket, connected, refresh]);

  // --- DM yardimcilari ---
  const setActivePeer = useCallback((peerId) => {
    activePeerRef.current = peerId;
  }, []);

  const bumpConversation = useCallback((partner, message) => {
    setConversations((prev) => {
      const others = prev.filter((c) => c.partner.id !== partner.id);
      return [
        {
          partner,
          lastMessage: { body: message.body, type: message.type || 'text', createdAt: message.createdAt, mine: true },
          unread: 0,
        },
        ...others,
      ];
    });
  }, []);

  const markRead = useCallback(async (peerId) => {
    setConversations((prev) => prev.map((c) => (c.partner.id === peerId ? { ...c, unread: 0 } : c)));
    try {
      await api.markRead(peerId);
    } catch {
      /* yoksay */
    }
  }, []);

  // --- Grup yardimcilari ---
  const setActiveGroup = useCallback((groupId) => {
    activeGroupRef.current = groupId;
  }, []);

  const bumpGroup = useCallback((groupId, message) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.group.id === groupId
          ? { ...g, lastMessage: { body: message.body, type: message.type || 'text', createdAt: message.createdAt, mine: true, senderId: message.senderId }, unread: 0 }
          : g
      )
    );
  }, []);

  const markGroupRead = useCallback((groupId) => {
    setGroups((prev) => prev.map((g) => (g.group.id === groupId ? { ...g, unread: 0 } : g)));
  }, []);

  const addGroup = useCallback((group) => {
    setGroups((prev) => {
      if (prev.some((g) => g.group.id === group.id)) return prev;
      return [{ group, lastMessage: null, unread: 0 }, ...prev];
    });
  }, []);

  // DM + grup birlesik, son etkinlige gore sirali
  const chats = useMemo(() => {
    const dm = conversations.map((c) => ({ kind: 'dm', id: c.partner.id, partner: c.partner, lastMessage: c.lastMessage, unread: c.unread, ts: c.lastMessage?.createdAt || 0 }));
    const gr = groups.map((g) => ({ kind: 'group', id: g.group.id, group: g.group, lastMessage: g.lastMessage, unread: g.unread, ts: g.lastMessage?.createdAt || g.group.createdAt || 0 }));
    return [...dm, ...gr].sort((a, b) => b.ts - a.ts);
  }, [conversations, groups]);

  const totalUnread =
    conversations.reduce((s, c) => s + c.unread, 0) + groups.reduce((s, g) => s + (g.unread || 0), 0);

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) ArzuDigital` : 'ArzuDigital Chat';
  }, [totalUnread]);

  const value = {
    chats, conversations, groups, totalUnread, refresh,
    setActivePeer, bumpConversation, markRead,
    setActiveGroup, bumpGroup, markGroupRead, addGroup,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat bir ChatProvider icinde kullanilmali');
  return ctx;
}
