// Profil fotografi secici (FAZ 1)
// Dosya secince aninda onizleme gosterir. Secilen File'i onChange ile yukari verir.

import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { Camera } from './Icons.jsx';

export default function AvatarPicker({ user, onChange, size = 96 }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  // Secilen dosyanin onizleme URL'ini temizle (bellek sizintisini onle)
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    onChange?.(file);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative rounded-full"
        aria-label="Profil fotografi sec"
      >
        {preview ? (
          <img
            src={preview}
            alt="onizleme"
            style={{ width: size, height: size }}
            className="rounded-full object-cover ring-2 ring-white dark:ring-neutral-900"
          />
        ) : (
          <Avatar user={user} size={size} />
        )}
        {/* Kamera rozeti */}
        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white ring-2 ring-white dark:ring-neutral-900">
          <Camera size={15} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
