// Cevrimici/son gorulme durumu (FAZ 4)
// Socket'ten 'presence' ve 'presence:init' olaylarini dinleyip harita tutar.

import { createContext, useContext, useEffect, useState } from 'react';
import { useSocket } from './SocketContext.jsx';

const PresenceContext = createContext(null);

export function PresenceProvider({ children }) {
  const { socket, connected } = useSocket();
  // userId -> { online: bool, lastSeen: number|null }
  const [presence, setPresence] = useState({});

  useEffect(() => {
    const s = socket.current;
    if (!s) return;

    function onInit({ online }) {
      setPresence((prev) => {
        const next = { ...prev };
        for (const id of online) next[id] = { online: true, lastSeen: next[id]?.lastSeen || null };
        return next;
      });
    }
    function onPresence({ userId, online, lastSeen }) {
      setPresence((prev) => ({ ...prev, [userId]: { online, lastSeen } }));
    }

    s.on('presence:init', onInit);
    s.on('presence', onPresence);
    return () => {
      s.off('presence:init', onInit);
      s.off('presence', onPresence);
    };
  }, [socket, connected]);

  return <PresenceContext.Provider value={presence}>{children}</PresenceContext.Provider>;
}

export function usePresence(userId) {
  const presence = useContext(PresenceContext);
  if (!userId) return presence; // tum harita
  return presence?.[userId] || { online: false, lastSeen: null };
}
