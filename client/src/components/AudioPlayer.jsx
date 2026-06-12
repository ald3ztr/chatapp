// Sesli mesaj oynatici (FAZ 3)
// Oynat/duraklat, ilerleme cubugu, sure. Baloncuk icinde kompakt gorunur.

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from './Icons.jsx';

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AudioPlayer({ src, durationMs, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(durationMs ? durationMs / 1000 : 0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => {
      // Bazi webm kayitlarinda duration Infinity olabilir; durationMs'e guven
      if (Number.isFinite(a.duration)) setTotal(a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play();
      setPlaying(true);
    }
  }

  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const accent = mine ? 'bg-white' : 'bg-blue-500';
  const track = mine ? 'bg-white/30' : 'bg-gray-200 dark:bg-neutral-600';
  const btn = mine ? 'bg-white text-blue-500' : 'bg-blue-500 text-white';

  return (
    <div className="flex w-52 items-center gap-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${btn}`}
        aria-label={playing ? 'Duraklat' : 'Oynat'}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`h-1.5 w-full overflow-hidden rounded-full ${track}`}>
          <div className={`h-full ${accent}`} style={{ width: `${pct}%` }} />
        </div>
        <div className={`mt-1 text-[11px] ${mine ? 'text-blue-100' : 'text-gray-400'}`}>
          {fmt(playing || current > 0 ? current : total)}
        </div>
      </div>
    </div>
  );
}
