// Arama arayuzu (WebRTC) - gelen arama / araniyor / goruseme ekrani.
// Ozellikler: araniyor onizlemesi, kucultup sohbete donme (suruklenebilir pencere),
// sekme degisince otomatik Picture-in-Picture, saglam cift yonlu ses.

import { useEffect, useRef, useState } from 'react';
import { useCall } from '../context/CallContext.jsx';
import Avatar from './Avatar.jsx';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, Minimize,
} from './Icons.jsx';

function CallTimer() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

// Bir <video>/<audio> ogesine MediaStream bagla. elRef verilirse o kullanilir (PiP icin).
function Media({ stream, audio, muted, className, elRef }) {
  const innerRef = useRef(null);
  const ref = elRef || innerRef;
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      // Otomatik oynatma engellenirse zorla dene
      ref.current.play?.().catch(() => {});
    }
  }, [stream, ref]);
  return audio ? (
    <audio ref={ref} autoPlay playsInline />
  ) : (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

export default function CallOverlay() {
  const {
    status, peer, callType, localStream, remoteStream, muted, videoOff, screenSharing,
    acceptCall, rejectCall, endCall, toggleMute, toggleVideo, toggleScreenShare,
  } = useCall();

  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState(null); // {x,y} kucuk pencere konumu; null = varsayilan kose
  const drag = useRef({ active: false, moved: false, dx: 0, dy: 0, w: 0, h: 0 });
  const remoteVideoRef = useRef(null);

  const isVideo = callType === 'video';

  // Arama bitince kucultme/konum sifirla
  useEffect(() => {
    if (status === 'idle') {
      setMinimized(false);
      setPos(null);
    }
  }, [status]);

  // Sekme gizlenince (baska sekmede gezerken) otomatik Picture-in-Picture (Teams gibi)
  useEffect(() => {
    if (!(status === 'connected' && isVideo)) return;
    async function onVis() {
      const v = remoteVideoRef.current;
      try {
        if (document.hidden && v && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
          await v.requestPictureInPicture();
        } else if (!document.hidden && document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        }
      } catch {
        /* tarayici izin vermezse yoksay */
      }
    }
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    };
  }, [status, isVideo]);

  if (status === 'idle' || !peer) return null;

  const ctrlBtn = 'flex h-14 w-14 items-center justify-center rounded-full';

  // --- Kucuk pencere surukleme ---
  function onPointerDown(e) {
    const box = e.currentTarget.getBoundingClientRect();
    drag.current = {
      active: true, moved: false,
      dx: e.clientX - box.left, dy: e.clientY - box.top,
      w: box.width, h: box.height,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current.active) return;
    drag.current.moved = true;
    const { w, h, dx, dy } = drag.current;
    let x = e.clientX - dx;
    let y = e.clientY - dy;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    setPos({ x, y });
  }
  function onPointerUp() {
    if (drag.current.moved && pos) {
      // Yatayda en yakin kenara yapis (sol/sag kose hissi)
      const w = drag.current.w;
      const snapX = pos.x + w / 2 < window.innerWidth / 2 ? 8 : window.innerWidth - w - 8;
      setPos((p) => (p ? { x: snapX, y: p.y } : p));
    }
    drag.current.active = false;
  }
  function onMiniClick() {
    if (!drag.current.moved) setMinimized(false); // suruklemediyse buyut
  }

  // Uzak ses her durumda calsin (sesli + goruntulu); goruntulu videoda ses ayri elemanda
  const remoteAudio = status === 'connected' && remoteStream ? (
    <Media stream={remoteStream} audio />
  ) : null;

  // --- KUCULTULMUS pencere ---
  if (minimized) {
    const miniStyle = pos
      ? { left: pos.x, top: pos.y }
      : { right: 16, bottom: 'calc(96px + env(safe-area-inset-bottom))' };
    return (
      <>
        {remoteAudio}
        <div
          style={{ position: 'fixed', ...miniStyle, touchAction: 'none' }}
          className="z-[60] h-44 w-32 cursor-grab overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 shadow-2xl active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onMiniClick}
        >
          {status === 'connected' && isVideo && remoteStream ? (
            <Media elRef={remoteVideoRef} stream={remoteStream} muted className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white">
              <Avatar user={peer} size={48} />
              <span className="px-1 text-center text-[11px] leading-tight">
                {status === 'connected' ? <CallTimer /> : status === 'calling' ? 'Araniyor...' : 'Arama'}
              </span>
            </div>
          )}
          {/* Bitir butonu */}
          <button
            onClick={(e) => { e.stopPropagation(); endCall(); }}
            className="absolute bottom-1.5 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow"
            aria-label="Aramayi bitir"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </>
    );
  }

  // --- TAM EKRAN ---
  // Goruntulu: bagliysa uzak video; araniyorsa kendi kameramiz (onizleme); degilse avatar
  const showRemoteFull = status === 'connected' && isVideo && remoteStream;
  const showLocalFull = isVideo && localStream && !showRemoteFull; // araniyor / baglanmadan once
  const canMinimize = status === 'calling' || status === 'connected';

  return (
    <>
      {remoteAudio}
      <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-900 text-white">
        {showRemoteFull ? (
          <Media elRef={remoteVideoRef} stream={remoteStream} muted className="absolute inset-0 h-full w-full bg-black object-cover" />
        ) : showLocalFull ? (
          // Araniyor onizlemesi: kendi kameramiz tam ekran (aynalanmis)
          <Media stream={localStream} muted className="absolute inset-0 h-full w-full bg-black object-cover -scale-x-100" />
        ) : (
          // Sesli arama / baglanmadan once: avatar + isim
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <Avatar user={peer} size={120} />
            <p className="text-2xl font-semibold">{peer.username}</p>
            <p className="text-white/70">
              {status === 'incoming' && `${isVideo ? 'Goruntulu' : 'Sesli'} arama...`}
              {status === 'calling' && 'Araniyor...'}
              {status === 'connected' && <CallTimer />}
            </p>
          </div>
        )}

        {/* Ust bilgi seridi (isim + sure/durum) + kucult butonu */}
        {(showRemoteFull || showLocalFull) && (
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent p-4">
            <div className="rounded-full bg-black/40 px-3 py-1 text-sm">
              {peer.username}
              {status === 'connected' ? <> · <CallTimer /></> : status === 'calling' ? ' · Araniyor...' : ''}
            </div>
            {canMinimize && (
              <button
                onClick={() => setMinimized(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
                aria-label="Kucult ve sohbete don"
              >
                <Minimize size={20} />
              </button>
            )}
          </div>
        )}

        {/* Goruntulu konusmada yerel kamera (kucuk pencere) - sadece baglandiktan sonra */}
        {showRemoteFull && localStream && (
          <div className="absolute right-4 top-16 h-40 w-28 overflow-hidden rounded-xl border border-white/20 bg-black">
            <Media
              stream={localStream}
              muted
              className={`h-full w-full ${screenSharing ? 'object-contain' : 'object-cover -scale-x-100'}`}
            />
          </div>
        )}

        {/* Sesli aramada kucult butonu (avatar gorunumunde) */}
        {!showRemoteFull && !showLocalFull && canMinimize && (
          <button
            onClick={() => setMinimized(true)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
            aria-label="Kucult ve sohbete don"
          >
            <Minimize size={20} />
          </button>
        )}

        {/* Kontroller */}
        <div className="relative z-10 mt-auto flex items-center justify-center gap-5 pb-10 pt-6"
             style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
          {status === 'incoming' ? (
            <>
              <button onClick={rejectCall} className={`${ctrlBtn} bg-red-500 text-white`} aria-label="Reddet">
                <PhoneOff size={26} />
              </button>
              <button onClick={acceptCall} className={`${ctrlBtn} bg-green-500 text-white`} aria-label="Kabul et">
                <Phone size={26} />
              </button>
            </>
          ) : (
            <>
              {status === 'connected' && (
                <button onClick={toggleMute} className={`${ctrlBtn} ${muted ? 'bg-white text-neutral-900' : 'bg-white/20 text-white'}`} aria-label="Sesi ac/kapat">
                  {muted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
              )}
              {status === 'connected' && isVideo && (
                <button onClick={toggleVideo} className={`${ctrlBtn} ${videoOff ? 'bg-white text-neutral-900' : 'bg-white/20 text-white'}`} aria-label="Kamerayi ac/kapat">
                  {videoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>
              )}
              {status === 'connected' && isVideo && (
                <button onClick={toggleScreenShare} className={`${ctrlBtn} ${screenSharing ? 'bg-white text-neutral-900' : 'bg-white/20 text-white'}`} aria-label="Ekran paylas">
                  {screenSharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}
                </button>
              )}
              <button onClick={endCall} className={`${ctrlBtn} bg-red-500 text-white`} aria-label="Aramayi bitir">
                <PhoneOff size={26} />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
