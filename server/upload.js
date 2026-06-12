// Dosya yukleme yapilandirmasi (FAZ 1 - profil fotograflari)
// multer ile uploads/ klasorune kaydeder. Sonraki fazlarda sohbet medyasi da buradan.

import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = join(__dirname, 'uploads');
mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = (extname(file.originalname) || '').toLowerCase().slice(0, 10);
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new Error('Yalnizca resim dosyalari yuklenebilir (jpeg, png, webp, gif).'));
  },
}).single('avatar');

// FAZ 3: sohbet medyasi (gorsel + ses)
const ALLOWED_MEDIA = new Set([
  // gorsel
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  // ses (MediaRecorder webm/ogg + yaygin formatlar)
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
  'audio/x-wav', 'audio/aac', 'audio/mp3',
]);

export const uploadMedia = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB (ses/gorsel)
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MEDIA.has(file.mimetype)) return cb(null, true);
    cb(new Error('Desteklenmeyen dosya turu. Gorsel veya ses dosyasi yukleyin.'));
  },
}).single('file');
