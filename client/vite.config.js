import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend portu (server/.env ile ayni olmali)
const BACKEND = 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // mobil cihazdan LAN uzerinden test edebilmek icin
    proxy: {
      // Socket.IO ve API isteklerini backend'e yonlendir
      '/socket.io': { target: BACKEND, ws: true, changeOrigin: true },
      '/api': { target: BACKEND, changeOrigin: true },
      '/uploads': { target: BACKEND, changeOrigin: true },
    },
  },
});
