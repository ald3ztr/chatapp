// Tam ekran gorsel goruntuleyici (FAZ 3)
// Arka plana veya kapat butonuna tiklayinca kapanir.

import { useEffect } from 'react';
import { X } from './Icons.jsx';

export default function ImageLightbox({ src, onClose }) {
  // ESC ile kapat
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        style={{ marginTop: 'env(safe-area-inset-top)' }}
        aria-label="Kapat"
      >
        <X size={22} />
      </button>
      <img
        src={src}
        alt="gorsel"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain"
      />
    </div>
  );
}
