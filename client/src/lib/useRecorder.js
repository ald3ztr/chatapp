// Sesli mesaj kaydi hook'u (FAZ 3) - MediaRecorder
// Not: mikrofon icin site HTTPS veya localhost olmali.

import { useCallback, useRef, useState } from 'react';

export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState('');

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  const start = useCallback(async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Bu tarayicida mikrofon desteklenmiyor.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Tarayici destegine gore mime sec
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg')
        ? 'audio/ogg'
        : '';
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.start();

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      timerRef.current = setInterval(
        () => setElapsedMs(Date.now() - startedAtRef.current),
        200
      );
      return true;
    } catch {
      setError('Mikrofon erisimi reddedildi.');
      return false;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  }, []);

  // Kaydi durdur → { blob, durationMs } dondur
  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const mr = mediaRef.current;
        if (!mr || mr.state === 'inactive') {
          cleanup();
          return resolve(null);
        }
        const durationMs = Date.now() - startedAtRef.current;
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
          cleanup();
          resolve({ blob, durationMs });
        };
        mr.stop();
      }),
    [cleanup]
  );

  // Kaydi iptal et (gondermeden)
  const cancel = useCallback(() => {
    const mr = mediaRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.onstop = null;
      mr.stop();
    }
    cleanup();
    setElapsedMs(0);
  }, [cleanup]);

  return { recording, elapsedMs, error, start, stop, cancel };
}
