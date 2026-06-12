// Socket.IO istemci baglantisi (FAZ 0)
// Vite proxy'si /socket.io isteklerini backend'e yonlendirir,
// bu yuzden ayni origin'e baglanmamiz yeterli.

import { io } from 'socket.io-client';

export const socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
